import { nowIso } from "@/lib/ids";
import type { Handoff, WorkstreamState } from "@/lib/schemas/contracts";
import { HandoffSchema } from "@/lib/schemas/contracts";
import {
  appendHandoff,
  getMissionControlState,
  upsertMissionControlState,
} from "@/lib/services/control-plane-state";
import { assertNoSilentPromotion } from "@/lib/services/evidence";
import { buildRecoveryPlan, recoveryToWorkstreamObjective } from "@/lib/services/recovery";

export type VerificationDecision = {
  pass: boolean;
  reasons: string[];
  evidence_ok: boolean;
  evidence_violations: string[];
};

export type VerificationOutcome = {
  mission_id: string;
  workstream_id: string;
  run_id: string;
  status: "PASS" | "FAIL";
  recovery_task_created: boolean;
  recovery_plan?: ReturnType<typeof buildRecoveryPlan>;
};

/** Pure verification gate — no persistence. */
export function evaluateHandoffVerification(handoff: Handoff): VerificationDecision {
  const evidenceCheck = assertNoSilentPromotion(handoff.evidence);
  const reasons: string[] = [];
  if (handoff.status !== "PASS") reasons.push("handoff status is not PASS");
  if (handoff.artifacts.length === 0) reasons.push("missing artifacts");
  if (handoff.evidence.length === 0) reasons.push("missing evidence");
  if (!evidenceCheck.ok) reasons.push(...evidenceCheck.violations);
  if (handoff.requires_human) reasons.push("requires human before integration");
  return {
    pass: reasons.length === 0,
    reasons,
    evidence_ok: evidenceCheck.ok,
    evidence_violations: evidenceCheck.violations,
  };
}

/**
 * Independent Verifier (+ recovery open on FAIL).
 * Workstream-level artifact write on PASS; final mission rollup is Result Integrator.
 */
export async function verifyHandoff(input: {
  missionId: string;
  handoff: Handoff;
  actor: string;
}): Promise<VerificationOutcome> {
  const handoff = HandoffSchema.parse(input.handoff);
  await appendHandoff(input.missionId, input.actor, handoff);

  const decision = evaluateHandoffVerification(handoff);
  const state = await getMissionControlState(input.missionId);

  if (!decision.pass) {
    const recoveryPlan = buildRecoveryPlan({
      situation: `Verification failed for workstream ${handoff.workstream_id}`,
      behavior:
        handoff.failures.join("; ") || "Missing artifact/evidence or invalid evidence promotion",
      impact: "Mission cannot integrate results safely",
      goal: "Restore verifiable deliverable for workstream",
      reality: decision.evidence_ok
        ? decision.reasons.join("; ") || "Artifact or evidence contract unmet"
        : decision.evidence_violations.join("; "),
      options: [
        "retry with corrected handoff",
        "reroute to another operator",
        "reconcile state",
        "escalate to owner",
      ],
      will: "Create recovery workstream and re-verify before integration",
      preferred: "RETRY",
    });
    const recoveryId = `${handoff.workstream_id}-RECOVERY`;
    const nextWorkstreams: WorkstreamState[] = [
      ...state.workstreams,
      {
        mission_id: input.missionId,
        workstream_id: recoveryId,
        correlation_id: `REC-${input.missionId}-${handoff.workstream_id}`,
        title: `Recovery for ${handoff.workstream_id}`,
        objective: recoveryToWorkstreamObjective(recoveryPlan),
        status: "PENDING",
        owner: "recovery",
        linear_issue_id: null,
        dependencies: [handoff.workstream_id],
        expected_output: ["corrected_output", "new_evidence"],
        required_capabilities: ["debug", "verification"],
        risk_level: "L1" as const,
        approval_required: recoveryPlan.allowed_recovery === "ESCALATE",
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
          notes: [
            "Missing artifact/evidence or handoff marked fail",
            ...decision.reasons,
            `recovery=${recoveryPlan.allowed_recovery}`,
          ],
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
      recovery_plan: recoveryPlan,
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
