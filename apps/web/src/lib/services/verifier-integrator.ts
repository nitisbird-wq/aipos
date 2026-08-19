import { nowIso } from "@/lib/ids";
import type { Handoff, WorkstreamState } from "@/lib/schemas/contracts";
import { HandoffSchema } from "@/lib/schemas/contracts";
import {
  appendHandoff,
  getMissionControlState,
  upsertMissionControlState,
} from "@/lib/services/control-plane-state";

export type VerificationOutcome = {
  mission_id: string;
  workstream_id: string;
  run_id: string;
  status: "PASS" | "FAIL";
  recovery_task_created: boolean;
};

export async function verifyAndIntegrateHandoff(input: {
  missionId: string;
  handoff: Handoff;
  actor: string;
}): Promise<VerificationOutcome> {
  const handoff = HandoffSchema.parse(input.handoff);
  await appendHandoff(input.missionId, input.actor, handoff);

  const pass =
    handoff.status === "PASS" &&
    handoff.artifacts.length > 0 &&
    handoff.evidence.length > 0 &&
    !handoff.requires_human;
  const state = await getMissionControlState(input.missionId);

  if (!pass) {
    const recoveryId = `${handoff.workstream_id}-RECOVERY`;
    const nextWorkstreams: WorkstreamState[] = [
      ...state.workstreams,
      {
        mission_id: input.missionId,
        workstream_id: recoveryId,
        correlation_id: `REC-${input.missionId}-${handoff.workstream_id}`,
        title: `Recovery for ${handoff.workstream_id}`,
        objective: "Correct failed output and resubmit for verification",
        status: "PENDING",
        owner: "recovery",
        linear_issue_id: null,
        dependencies: [handoff.workstream_id],
        expected_output: ["corrected_output", "new_evidence"],
        required_capabilities: ["debug", "verification"],
        risk_level: "L1" as const,
        approval_required: false,
        updated_at: nowIso(),
      },
    ];
    await upsertMissionControlState(input.missionId, input.actor, {
      workstreams: nextWorkstreams,
      verifications: [
        ...state.verifications,
        {
          mission_id: input.missionId,
          workstream_id: handoff.workstream_id,
          run_id: handoff.run_id,
          status: "FAIL",
          verifier: input.actor,
          notes: ["Missing artifact/evidence or handoff marked fail"],
          recovery_required: true,
          verified_at: nowIso(),
        },
      ],
      mission_state: "RECONCILING",
      next_action: "Execute recovery workstream before integration",
      responsible: "recovery",
      updated_at: nowIso(),
    });
    return {
      mission_id: input.missionId,
      workstream_id: handoff.workstream_id,
      run_id: handoff.run_id,
      status: "FAIL",
      recovery_task_created: true,
    };
  }

  const artifacts = [
    ...state.artifacts,
    ...handoff.artifacts.map((uri, idx) => ({
      mission_id: input.missionId,
      workstream_id: handoff.workstream_id,
      artifact_id: `${handoff.run_id}-ART-${idx + 1}`,
      uri,
      kind: "worker_result",
      created_at: nowIso(),
    })),
  ];
  const verifications = [
    ...state.verifications,
    {
      mission_id: input.missionId,
      workstream_id: handoff.workstream_id,
      run_id: handoff.run_id,
      status: "PASS" as const,
      verifier: input.actor,
      notes: handoff.verification,
      recovery_required: false,
      verified_at: nowIso(),
    },
  ];
  const nextWorkstreams: WorkstreamState[] = state.workstreams.map((row) =>
    row.workstream_id === handoff.workstream_id
      ? { ...row, status: "COMPLETED" as const, updated_at: nowIso() }
      : row,
  );
  const allDone = nextWorkstreams.every((row) => row.status === "COMPLETED");
  await upsertMissionControlState(input.missionId, input.actor, {
    workstreams: nextWorkstreams,
    artifacts,
    verifications,
    mission_state: allDone ? "INTEGRATING" : "VERIFYING",
    next_action: allDone ? "Generate final mission deliverable" : "Verify remaining workstreams",
    responsible: allDone ? "integrator" : "verifier",
    updated_at: nowIso(),
  });
  return {
    mission_id: input.missionId,
    workstream_id: handoff.workstream_id,
    run_id: handoff.run_id,
    status: "PASS",
    recovery_task_created: false,
  };
}

export async function integrateMissionResults(missionId: string) {
  const state = await getMissionControlState(missionId);
  const passed = state.verifications.filter((row) => row.status === "PASS");
  const summary = {
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
