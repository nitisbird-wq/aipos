import {
  CreateIntakeRequestSchema,
  CorrectIntakeRequestSchema,
  ConfirmIntakeRequestSchema,
  type IntakeMissionBundle,
  type CreateIntakeRequest,
  type CorrectIntakeRequest,
} from "@/lib/schemas/intake";
import { getRepository, getPersistenceMode } from "@/lib/repositories";
import { analyzeMissionHeuristic } from "@/lib/services/analyze";
import { evaluateReadiness } from "@/lib/gates/readiness-gate";
import { evaluateHandling } from "@/lib/gates/handling-gate";
import { evaluateMapping } from "@/lib/gates/mapping-gate";
import { mapBundleToMission } from "@/lib/services/mapping-service";
import { syncMissionToNotion } from "@/lib/services/notion-sync-service";
import { runCapabilityPreflight } from "@/lib/services/preflight-service";
import {
  assertOperatorActor,
  newAuditId,
  newCorrelationId,
  newIdempotencyKey,
  newIntakeId,
  newPolicyDecisionId,
  nowIso,
} from "@/lib/ids";

const INTAKE_CHANNEL_DESTINATION = {
  system: "intake_channel",
  trust_class: "approved_private",
  purpose: "chat_only",
  persistence: "conversation_only",
  external_transfer: false,
} as const;

const NOTION_DESTINATION = {
  system: "notion",
  trust_class: "approved_private",
  purpose: "mission_registry",
  persistence: "durable",
  external_transfer: true,
} as const;

export async function createIntake(
  input: CreateIntakeRequest,
  actor: string,
): Promise<{ bundle: IntakeMissionBundle; reused: boolean }> {
  const parsed = CreateIntakeRequestSchema.parse(input);
  const repo = getRepository();
  const idempotency_key = parsed.idempotency_key || newIdempotencyKey();

  const existing = await repo.getIntakeByIdempotencyKey(idempotency_key);
  if (existing) {
    return { bundle: existing, reused: true };
  }

  const now = nowIso();
  const intake_id = newIntakeId();
  const bundle: IntakeMissionBundle = {
    intake_id,
    intake_version: "1.0",
    requester_id: actor,
    source: "web_app",
    source_message_ref: `web:${intake_id}`,
    raw_request: parsed.raw_request,
    mission_summary: "",
    desired_outcome: "",
    success_criteria: [],
    constraints: parsed.constraints ?? [],
    assumptions: [],
    missing_blockers: [],
    draft_workstreams: [],
    capability_families: [],
    operational_risk: "L0",
    sensitivity_flags: [],
    sensitivity_acknowledged: false,
    approval_requirements: [],
    knowledge_refs: [],
    attachments: parsed.attachments ?? [],
    data_destinations: [{ ...INTAKE_CHANNEL_DESTINATION }],
    data_handling_requirements: [],
    deadline: parsed.deadline ?? null,
    readiness_status: "needs_input",
    confirmed_by_user: false,
    idempotency_key,
    created_at: now,
    updated_at: now,
  };

  await repo.saveIntake(bundle);
  await repo.appendAudit({
    id: newAuditId(),
    aggregate_type: "intake",
    mission_id: null,
    intake_id,
    actor,
    action: "intake:create",
    reason: "Intake captured from web_app",
    correlation_id: newCorrelationId(),
    causation_id: null,
    previous_state: null,
    new_state: "needs_input",
    policy_result: {
      decision: "allow",
      persistence_mode: getPersistenceMode(),
      adapter: repo.adapterName,
    },
    created_at: now,
  });

  return { bundle, reused: false };
}

export async function analyzeIntake(intakeId: string, actor: string): Promise<IntakeMissionBundle> {
  const repo = getRepository();
  const existing = await repo.getIntakeById(intakeId);
  if (!existing) throw new Error("INTAKE_NOT_FOUND");
  if (existing.confirmed_by_user) throw new Error("INTAKE_ALREADY_CONFIRMED");
  if (existing.readiness_status === "cancelled") throw new Error("INTAKE_CANCELLED");

  const analysis = analyzeMissionHeuristic(existing.raw_request, existing.constraints);

  const { intake_validation, ...missionFields } = analysis;

  const updated: IntakeMissionBundle = {
    ...existing,
    ...missionFields,
    knowledge_refs: [
      ...existing.knowledge_refs.filter(
        (r) => (r as { kind?: string }).kind !== "intake_validation",
      ),
      {
        kind: "intake_validation",
        ...intake_validation,
      },
    ],
    data_destinations: [{ ...INTAKE_CHANNEL_DESTINATION }],
    sensitivity_acknowledged:
      analysis.sensitivity_flags.length === 0 ? true : existing.sensitivity_acknowledged,
    updated_at: nowIso(),
  };

  const readiness = evaluateReadiness(updated);
  updated.readiness_status = readiness.readiness_status;

  await repo.saveIntake(updated);
  await repo.appendAudit({
    id: newAuditId(),
    aggregate_type: "intake",
    mission_id: null,
    intake_id: intakeId,
    actor,
    action: "intake:analyze",
    reason: "Heuristic analysis applied",
    correlation_id: newCorrelationId(),
    causation_id: null,
    previous_state: existing.readiness_status,
    new_state: updated.readiness_status,
    policy_result: {
      decision: "allow",
      readiness,
      analyze_provider: process.env.ANALYZE_PROVIDER || "none",
    },
    created_at: nowIso(),
  });

  return updated;
}

export async function correctIntake(
  intakeId: string,
  patch: CorrectIntakeRequest,
  actor: string,
): Promise<IntakeMissionBundle> {
  const parsed = CorrectIntakeRequestSchema.parse(patch);
  const repo = getRepository();
  const existing = await repo.getIntakeById(intakeId);
  if (!existing) throw new Error("INTAKE_NOT_FOUND");
  if (existing.confirmed_by_user) throw new Error("INTAKE_ALREADY_CONFIRMED");
  if (existing.readiness_status === "cancelled") throw new Error("INTAKE_CANCELLED");

  const updated: IntakeMissionBundle = {
    ...existing,
    ...parsed,
    raw_request: existing.raw_request,
    intake_id: existing.intake_id,
    idempotency_key: existing.idempotency_key,
    confirmed_by_user: false,
    updated_at: nowIso(),
  };

  if (updated.sensitivity_acknowledged) {
    updated.missing_blockers = updated.missing_blockers.map((b) =>
      b.code === "ACKNOWLEDGE_SENSITIVITY"
        ? { ...b, resolved: true, answer: "Acknowledged by user" }
        : b,
    );
  }

  const readiness = evaluateReadiness(updated);
  updated.readiness_status = readiness.readiness_status;

  await repo.saveIntake(updated);
  await repo.appendAudit({
    id: newAuditId(),
    aggregate_type: "intake",
    mission_id: null,
    intake_id: intakeId,
    actor,
    action: "intake:correct",
    reason: "User corrected understanding fields",
    correlation_id: newCorrelationId(),
    causation_id: null,
    previous_state: existing.readiness_status,
    new_state: updated.readiness_status,
    policy_result: { decision: "allow", readiness },
    created_at: nowIso(),
  });

  return updated;
}

export async function cancelIntake(intakeId: string, actor: string, reason: string) {
  const repo = getRepository();
  const existing = await repo.getIntakeById(intakeId);
  if (!existing) throw new Error("INTAKE_NOT_FOUND");
  if (existing.confirmed_by_user) throw new Error("INTAKE_ALREADY_CONFIRMED");

  const updated: IntakeMissionBundle = {
    ...existing,
    readiness_status: "cancelled",
    updated_at: nowIso(),
  };
  await repo.saveIntake(updated);
  await repo.appendAudit({
    id: newAuditId(),
    aggregate_type: "intake",
    mission_id: null,
    intake_id: intakeId,
    actor,
    action: "intake:cancel",
    reason,
    correlation_id: newCorrelationId(),
    causation_id: null,
    previous_state: existing.readiness_status,
    new_state: "cancelled",
    policy_result: { decision: "allow", cancelled: true },
    created_at: nowIso(),
  });
  return updated;
}

export async function confirmIntake(
  intakeId: string,
  body: unknown,
  actor: string,
  correlationId?: string,
) {
  try {
    assertOperatorActor(actor);
  } catch {
    return {
      ok: false as const,
      error: {
        code: "ACTOR_NOT_AUTHORIZED",
        message: "Only operator actors may confirm; ChatGPT cannot confirm on behalf of the user",
      },
    };
  }

  const parsed = ConfirmIntakeRequestSchema.parse(body ?? {});
  const repo = getRepository();
  const existing = await repo.getIntakeById(intakeId);
  if (!existing) {
    return { ok: false as const, error: { code: "INTAKE_NOT_FOUND", message: "Intake not found" } };
  }
  if (existing.readiness_status === "cancelled") {
    return {
      ok: false as const,
      error: { code: "INTAKE_NOT_CONFIRMED", message: "Intake is cancelled" },
    };
  }

  const correlation_id = correlationId || newCorrelationId();

  const existingMission = await repo.getMissionByIntakeIdAndVersion(
    intakeId,
    existing.intake_version,
  );
  if (existingMission) {
    const sync = await repo.getNotionSync(existingMission.mission_id);
    return {
      ok: true as const,
      mission_id: existingMission.mission_id,
      status: existingMission.status,
      reused: true as const,
      notion: {
        sync_status: sync?.sync_status ?? "not_started",
        notion_page_id: sync?.notion_page_id ?? null,
        mock_record_id: null,
        message: "Idempotent confirm — existing mission returned",
      },
    };
  }

  let bundle: IntakeMissionBundle = {
    ...existing,
    sensitivity_acknowledged: parsed.sensitivity_acknowledged ?? existing.sensitivity_acknowledged,
    confirmed_by_user: true,
    updated_at: nowIso(),
  };

  if (bundle.sensitivity_acknowledged) {
    bundle.missing_blockers = bundle.missing_blockers.map((b) =>
      b.code === "ACKNOWLEDGE_SENSITIVITY"
        ? { ...b, resolved: true, answer: "Acknowledged at confirm" }
        : b,
    );
  }

  const hasNotion = bundle.data_destinations.some((d) => d.system === "notion");
  if (!hasNotion) {
    bundle = {
      ...bundle,
      data_destinations: [...bundle.data_destinations, { ...NOTION_DESTINATION }],
    };
  }

  const readiness = evaluateReadiness(bundle);
  if (!readiness.ok) {
    bundle.readiness_status = "needs_input";
    bundle.confirmed_by_user = false;
    await repo.saveIntake(bundle);
    if (readiness.codes.includes("UNRESOLVED_BLOCKER")) {
      return {
        ok: false as const,
        error: {
          code: "UNRESOLVED_BLOCKER",
          message: readiness.reasons.join("; "),
        },
      };
    }
    if (readiness.codes.includes("MISSING_SUCCESS_CRITERIA")) {
      return {
        ok: false as const,
        error: {
          code: "MISSING_SUCCESS_CRITERIA",
          message: readiness.reasons.join("; "),
        },
      };
    }
    return {
      ok: false as const,
      error: {
        code: "INTAKE_NOT_CONFIRMED",
        message: readiness.reasons.join("; "),
      },
    };
  }

  bundle.readiness_status = "ready_to_dispatch";

  const handling = evaluateHandling(bundle);
  if (!handling.ok) {
    bundle.confirmed_by_user = false;
    bundle.readiness_status = "awaiting_confirmation";
    await repo.saveIntake(bundle);
    return {
      ok: false as const,
      error: {
        code: "HANDLING_GATE_FAILED",
        message: handling.reasons.join("; "),
      },
    };
  }

  const mapping = evaluateMapping(bundle);
  if (!mapping.ok) {
    bundle.confirmed_by_user = false;
    bundle.readiness_status = "awaiting_confirmation";
    await repo.saveIntake(bundle);
    return {
      ok: false as const,
      error: { code: mapping.code, message: mapping.message },
    };
  }

  const mission = mapBundleToMission(bundle);

  // Phase 2 Core Control: Capability–Connection–Authority Preflight
  // before Assignment/Execution (Assignment/Execution remain Phase 3).
  const preflight = await runCapabilityPreflight({
    bundle,
    missionId: mission.mission_id,
  });
  mission.gate_results = {
    ...(mission.gate_results ?? {}),
    preflight,
  };
  mission.planning_input = {
    ...(mission.planning_input ?? {}),
    preflight_disposition: preflight.disposition,
    selected_tool_id: preflight.selected_tool_id,
    assignment_execution_blocked: preflight.assignment_execution_blocked ?? true,
  };
  mission.evidence_refs = [...mission.evidence_refs, `preflight:${preflight.preflight_id}`];

  const policy_decision_id = newPolicyDecisionId("MAP");
  await repo.saveIntake(bundle);
  await repo.saveMission(mission);

  await repo.appendAudit({
    id: newAuditId(),
    aggregate_type: "mission",
    mission_id: mission.mission_id,
    intake_id: bundle.intake_id,
    actor,
    action: "preflight:evaluate",
    reason: preflight.selection_reason,
    correlation_id,
    causation_id: null,
    previous_state: "ready_to_dispatch",
    new_state: preflight.disposition,
    policy_result: {
      decision:
        preflight.disposition === "blocked"
          ? "block"
          : preflight.disposition === "approval_required"
            ? "require_approval"
            : "allow",
      preflight_id: preflight.preflight_id,
      disposition: preflight.disposition,
      selected_tool_id: preflight.selected_tool_id,
      blocking_codes: preflight.blocking_codes,
      claims: preflight.claims,
      user_actions: preflight.user_actions,
      manual_fallback: preflight.manual_fallback,
    },
    created_at: nowIso(),
  });

  await repo.appendAudit({
    id: newAuditId(),
    aggregate_type: "mission",
    mission_id: mission.mission_id,
    intake_id: bundle.intake_id,
    actor,
    action: "mapping:accept",
    reason: parsed.reason,
    correlation_id,
    causation_id: null,
    previous_state: "ready_to_dispatch",
    new_state: "ready",
    policy_result: {
      decision: "allow",
      policy_decision_id,
      preflight_id: preflight.preflight_id,
      preflight_disposition: preflight.disposition,
      ...mapping.policy_result,
    },
    created_at: nowIso(),
  });

  const notionOutcome = await syncMissionToNotion(mission, actor, correlation_id, {
    policy_decision_id,
    verification_method: "user_confirm_mapping",
  });

  return {
    ok: true as const,
    mission_id: mission.mission_id,
    status: mission.status,
    reused: false as const,
    preflight: {
      preflight_id: preflight.preflight_id,
      disposition: preflight.disposition,
      selected_tool_id: preflight.selected_tool_id,
      selection_reason: preflight.selection_reason,
      user_actions: preflight.user_actions,
      claims: preflight.claims,
      assignment_execution_blocked: preflight.assignment_execution_blocked ?? true,
      blocking_codes: preflight.blocking_codes,
    },
    notion: {
      sync_status: notionOutcome.sync_status,
      notion_page_id: notionOutcome.notion_page_id,
      mock_record_id: notionOutcome.mock_record_id ?? null,
      message: notionOutcome.message,
      ...(notionOutcome.error ? { error: notionOutcome.error } : {}),
    },
  };
}
