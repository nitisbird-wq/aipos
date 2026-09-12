import { nowIso } from "@/lib/ids";
import {
  getMissionControlState,
  upsertMissionControlState,
} from "@/lib/services/control-plane-state";

export type MissionIntegrationSummary = {
  mission_id: string;
  completed_workstreams: string[];
  artifact_refs: string[];
  verification_count: number;
  final_status: "READY_FOR_OWNER_REVIEW" | "INSUFFICIENT_EVIDENCE";
};

/**
 * Independent Result Integrator — mission rollup after verified workstreams.
 * Never invents PASS; only aggregates existing verification rows + artifacts.
 */
export async function integrateMissionResults(
  missionId: string,
): Promise<MissionIntegrationSummary> {
  const state = await getMissionControlState(missionId);
  const passed = state.verifications.filter((row) => row.status === "PASS");
  const summary: MissionIntegrationSummary = {
    mission_id: missionId,
    completed_workstreams: passed.map((row) => row.workstream_id),
    artifact_refs: state.artifacts.map((row) => row.uri),
    verification_count: passed.length,
    final_status: passed.length > 0 ? "READY_FOR_OWNER_REVIEW" : "INSUFFICIENT_EVIDENCE",
  };
  await upsertMissionControlState(missionId, "result_integrator", {
    mission_state: passed.length > 0 ? "COMPLETED" : "VERIFYING",
    next_action:
      passed.length > 0
        ? "Present final deliverable to owner"
        : "Collect additional verified outputs",
    responsible: passed.length > 0 ? "owner" : "integrator",
    updated_at: nowIso(),
  });
  return summary;
}
