import type { IntakeMissionBundle } from "@/lib/schemas/intake";
import type { MissionObject } from "@/lib/schemas/mission";
import { missionIdFromIntake, nowIso } from "@/lib/ids";
import { ownerVisibleRequest } from "@/lib/redact";

function extractIntakeValidation(bundle: IntakeMissionBundle) {
  const ref = bundle.knowledge_refs.find(
    (r) => (r as { kind?: string }).kind === "intake_validation",
  ) as
    | {
        kind: string;
        language?: string;
        system_checks?: string[];
        gate_hints?: string[];
      }
    | undefined;

  return {
    language: ref?.language ?? "en",
    system_checks: ref?.system_checks ?? [],
    gate_hints: ref?.gate_hints ?? ["readiness", "handling", "mapping"],
  };
}

/**
 * Maps a confirmed IntakeMissionBundle into a Mission Object (Mapping Accept).
 * C-03: mission_id is deterministic from intake_id + intake_version.
 * success_criteria = mission outcome only.
 * System intake checks → gate_results / intake_validation.
 */
export function mapBundleToMission(bundle: IntakeMissionBundle): MissionObject {
  const now = nowIso();
  const mission_id = missionIdFromIntake(bundle.intake_id, bundle.intake_version);
  const intake_validation = extractIntakeValidation(bundle);
  const ownerRequest = ownerVisibleRequest(bundle.raw_request);

  const anticipated = [
    ...bundle.approval_requirements.map((a) =>
      typeof a === "object" && a && "reason" in a
        ? String((a as { reason?: string }).reason ?? "approval")
        : "approval",
    ),
    ...bundle.draft_workstreams.flatMap((ws) => ws.approval_points),
  ];

  const missionCriteria = bundle.success_criteria.filter(
    (c) =>
      !/Mission Object created with status/i.test(c) &&
      !/status=ready \(system/i.test(c) &&
      !/User confirms understanding/i.test(c) &&
      !/ผู้ใช้ยืนยันความเข้าใจภารกิจ/.test(c) &&
      !/สร้าง Mission Object/.test(c) &&
      !/Readiness \/ Handling \/ Mapping/.test(c) &&
      !/ผ่าน Readiness/.test(c),
  );

  return {
    mission_id,
    object_version: "1.0",
    revision: 1,
    source_intake_id: bundle.intake_id,
    source_intake_version: bundle.intake_version,
    mapping_version: "1.0",
    status: "ready",
    planning_status: "not_started",
    planning_revision: 0,
    last_planned_at: null,
    planning_reason: null,
    criticality: bundle.operational_risk >= "L3" ? "high" : "normal",
    subtask_ids: [],
    current_blockers: [],
    approval_policy_refs: ["AIPOS-GOV-001", "AIPOS-GOV-002", "AIPOS-GOV-003"],
    anticipated_approval_points: Array.from(new Set(anticipated)),
    evidence_refs: [`intake:${bundle.intake_id}`, `idempotency:${bundle.idempotency_key}`],
    title: bundle.mission_summary.slice(0, 120),
    mission_summary: bundle.mission_summary,
    desired_outcome: bundle.desired_outcome,
    success_criteria: missionCriteria,
    constraints: bundle.constraints,
    deadline: bundle.deadline,
    operational_risk: bundle.operational_risk,
    sensitivity_flags: bundle.sensitivity_flags,
    governance: {
      data_destinations: bundle.data_destinations,
      data_handling_requirements: bundle.data_handling_requirements,
      sensitivity_acknowledged: bundle.sensitivity_acknowledged,
    },
    planning_input: {
      draft_workstreams: bundle.draft_workstreams,
      capability_families: bundle.capability_families,
    },
    intake_evidence: {
      raw_request: ownerRequest.text,
      assumptions: bundle.assumptions,
      confirmed_by_user: bundle.confirmed_by_user,
      confirmed_at: now,
      source: bundle.source,
      source_message_ref: bundle.source_message_ref,
      intake_validation,
    },
    gate_results: {
      intake_validation,
      system_checks: intake_validation.system_checks,
      mapping_version: "1.0",
    },
  };
}
