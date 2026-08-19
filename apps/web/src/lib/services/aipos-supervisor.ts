import { getRepository } from "@/lib/repositories";
import { nowIso } from "@/lib/ids";
import {
  getMissionControlState,
  upsertMissionControlState,
} from "@/lib/services/control-plane-state";
import type { MissionControlState } from "@/lib/schemas/contracts";

export type SupervisorAssessment = {
  mission_id: string;
  mission_state: MissionControlState["mission_state"];
  responsible: string;
  next_action: string;
  duplicate_workstreams: string[];
  blocked_workstreams: string[];
  in_progress_workstreams: string[];
  stale: boolean;
};

function uniq<T>(items: T[]): T[] {
  return Array.from(new Set(items));
}

export async function runSupervisorAssessment(missionId: string): Promise<SupervisorAssessment> {
  const state = await getMissionControlState(missionId);
  const ids = state.workstreams.map((row) => row.workstream_id);
  const duplicateWorkstreams = uniq(ids.filter((id, index) => ids.indexOf(id) !== index));
  const blocked = state.workstreams
    .filter((row) => row.status === "BLOCKED" || row.status === "FAILED")
    .map((row) => row.workstream_id);
  const active = state.workstreams
    .filter((row) => ["DISPATCHED", "WORKER_READY", "EXECUTING", "VERIFYING"].includes(row.status))
    .map((row) => row.workstream_id);
  const staleMs = Date.now() - Date.parse(state.updated_at);
  const stale = staleMs > 1000 * 60 * 60;

  let nextAction = state.next_action;
  let responsible = state.responsible;
  if (blocked.length > 0) {
    nextAction = "Resolve blockers before dispatching additional workstreams";
    responsible = "aipos_supervisor";
  } else if (active.length > 0) {
    nextAction = "Collect worker handoffs and run verifier";
    responsible = "verifier";
  } else if (state.workstreams.length === 0) {
    nextAction = "Decompose mission and dispatch workstreams";
    responsible = "dispatcher";
  } else {
    nextAction = "Dispatch pending workstreams";
    responsible = "dispatcher";
  }

  await upsertMissionControlState(missionId, "aipos_supervisor", {
    next_action: nextAction,
    responsible,
    updated_at: nowIso(),
  });

  return {
    mission_id: missionId,
    mission_state: state.mission_state,
    responsible,
    next_action: nextAction,
    duplicate_workstreams: duplicateWorkstreams,
    blocked_workstreams: blocked,
    in_progress_workstreams: active,
    stale,
  };
}

export async function initializeMissionControlState(missionId: string) {
  const repo = getRepository();
  const mission = await repo.getMissionById(missionId);
  if (!mission) throw new Error("MISSION_NOT_FOUND");
  await upsertMissionControlState(missionId, "aipos_supervisor", {
    mission_state: mission.status === "ready" ? "PLANNED" : "CAPTURED",
    next_action: "Decompose mission and prepare dispatch",
    responsible: "dispatcher",
    updated_at: nowIso(),
  });
  return getMissionControlState(missionId);
}
