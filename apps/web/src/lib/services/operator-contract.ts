import { nowIso } from "@/lib/ids";
import {
  getMissionControlState,
  upsertMissionControlState,
} from "@/lib/services/control-plane-state";

export type WorkerAssignmentPackage = {
  mission_id: string;
  workstream_id: string;
  run_id: string;
  scoped_context: string[];
  tools_allowed: string[];
  expected_output: string[];
  evidence_requirements: string[];
  authority_level: "L0" | "L1" | "L2" | "L3" | "L4";
  high_impact_actions_allowed: false;
};

export async function buildWorkerAssignmentPackages(
  missionId: string,
): Promise<WorkerAssignmentPackage[]> {
  const state = await getMissionControlState(missionId);
  const rows = state.workstreams
    .filter((row) => row.status === "DISPATCHED")
    .map((row, index) => ({
      mission_id: missionId,
      workstream_id: row.workstream_id,
      run_id: `RUN-${missionId}-${index + 1}`,
      scoped_context: [
        `Mission: ${missionId}`,
        `Objective: ${row.objective}`,
        `Dependencies: ${row.dependencies.join(", ") || "none"}`,
      ],
      tools_allowed: ["repo_read", "repo_write", "tests", "artifacts"],
      expected_output: row.expected_output,
      evidence_requirements: ["execution_log", "artifact_ref", "verification_claims"],
      authority_level: row.risk_level,
      high_impact_actions_allowed: false as const,
    }));

  await upsertMissionControlState(missionId, "operator_contract", {
    workstreams: state.workstreams.map((row) =>
      rows.some((assignment) => assignment.workstream_id === row.workstream_id)
        ? { ...row, status: "WORKER_READY", updated_at: nowIso() }
        : row,
    ),
    mission_state: rows.length > 0 ? "APPROVED" : state.mission_state,
    next_action: rows.length > 0 ? "Dispatch worker assignments" : state.next_action,
    responsible: rows.length > 0 ? "supervisor" : state.responsible,
    updated_at: nowIso(),
  });

  return rows;
}
