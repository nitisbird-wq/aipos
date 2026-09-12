import { getRepository } from "@/lib/repositories";
import { newAuditId, newCorrelationId, nowIso } from "@/lib/ids";
import type { MissionObject } from "@/lib/schemas/mission";
import {
  MissionControlStateSchema,
  type ArtifactState,
  type BlockerState,
  type Handoff,
  type MissionControlState,
  type VerificationState,
  type WorkstreamState,
} from "@/lib/schemas/contracts";

type ControlPatch = Partial<
  Pick<MissionControlState, "mission_state" | "next_action" | "responsible" | "updated_at">
> & {
  workstreams?: WorkstreamState[];
  handoffs?: Handoff[];
  artifacts?: ArtifactState[];
  verifications?: VerificationState[];
  blockers?: BlockerState[];
};

function inferMissionState(mission: MissionObject): MissionControlState["mission_state"] {
  if (mission.status === "cancelled") return "CANCELLED";
  if (mission.status === "blocked") return "BLOCKED";
  if (mission.status === "ready") return "UNDERSTOOD";
  return "CAPTURED";
}

function baseState(mission: MissionObject): MissionControlState {
  return MissionControlStateSchema.parse({
    state_version: "control-plane.v1",
    mission_id: mission.mission_id,
    mission_state: inferMissionState(mission),
    next_action: "Await supervisor planning pass",
    responsible: "aipos_supervisor",
    workstreams: [],
    agent_runs: [],
    handoffs: [],
    artifacts: [],
    verifications: [],
    blockers: [],
    updated_at: nowIso(),
  });
}

export async function getMissionControlState(missionId: string): Promise<MissionControlState> {
  const repo = getRepository();
  const mission = await repo.getMissionById(missionId);
  if (!mission) throw new Error("MISSION_NOT_FOUND");
  const audit = await repo.listAudit({ mission_id: missionId });
  const snapshot = audit.find((event) => event.action === "control_plane:state_upsert");
  if (!snapshot) return baseState(mission);
  const row = (snapshot.policy_result as { state?: unknown }).state;
  if (!row) return baseState(mission);
  return MissionControlStateSchema.parse(row);
}

export async function upsertMissionControlState(
  missionId: string,
  actor: string,
  patch: ControlPatch,
): Promise<MissionControlState> {
  const repo = getRepository();
  const current = await getMissionControlState(missionId);
  const next = MissionControlStateSchema.parse({
    ...current,
    ...patch,
    workstreams: patch.workstreams ?? current.workstreams,
    handoffs: patch.handoffs ?? current.handoffs,
    artifacts: patch.artifacts ?? current.artifacts,
    verifications: patch.verifications ?? current.verifications,
    blockers: patch.blockers ?? current.blockers,
    updated_at: patch.updated_at ?? nowIso(),
  });
  await repo.appendAudit({
    id: newAuditId(),
    aggregate_type: "system",
    mission_id: missionId,
    intake_id: null,
    actor,
    action: "control_plane:state_upsert",
    reason: "Mission control state updated",
    correlation_id: newCorrelationId(),
    causation_id: null,
    previous_state: current.mission_state,
    new_state: next.mission_state,
    policy_result: { decision: "allow", state: next },
    created_at: nowIso(),
  });
  return next;
}

export async function appendHandoff(missionId: string, actor: string, handoff: Handoff) {
  const state = await getMissionControlState(missionId);
  const next = [...state.handoffs.filter((row) => row.run_id !== handoff.run_id), handoff];
  return upsertMissionControlState(missionId, actor, { handoffs: next, updated_at: nowIso() });
}
