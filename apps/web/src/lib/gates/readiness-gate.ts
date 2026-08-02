import type { IntakeMissionBundle } from "@/lib/schemas/intake";

export type ReadinessGateResult = {
  ok: boolean;
  readiness_status: IntakeMissionBundle["readiness_status"];
  codes: string[];
  reasons: string[];
};

/**
 * Readiness Gate — evaluates whether an IntakeMissionBundle may progress
 * toward awaiting_confirmation / ready_to_dispatch.
 */
export function evaluateReadiness(bundle: IntakeMissionBundle): ReadinessGateResult {
  const codes: string[] = [];
  const reasons: string[] = [];

  if (!bundle.mission_summary?.trim()) {
    codes.push("MISSING_MISSION_SUMMARY");
    reasons.push("mission_summary is required");
  }
  if (!bundle.desired_outcome?.trim()) {
    codes.push("MISSING_DESIRED_OUTCOME");
    reasons.push("desired_outcome is required");
  }
  if (!bundle.success_criteria || bundle.success_criteria.length < 1) {
    codes.push("MISSING_SUCCESS_CRITERIA");
    reasons.push("At least one success criterion is required");
  }
  if (!bundle.operational_risk) {
    codes.push("MISSING_OPERATIONAL_RISK");
    reasons.push("operational_risk is required");
  }
  if (!bundle.data_destinations || bundle.data_destinations.length < 1) {
    codes.push("MISSING_DATA_DESTINATIONS");
    reasons.push("At least one data destination is required");
  }
  if (bundle.data_destinations?.some((d) => d.system === "none")) {
    codes.push("FORBIDDEN_DESTINATION_NONE");
    reasons.push("system=none is forbidden; use intake_channel");
  }

  const unresolved = (bundle.missing_blockers ?? []).filter((b) => b.blocking && !b.resolved);
  if (unresolved.length > 0) {
    codes.push("UNRESOLVED_BLOCKER");
    reasons.push(`${unresolved.length} unresolved blocking item(s)`);
  }

  if (bundle.sensitivity_flags.length > 0 && !bundle.sensitivity_acknowledged) {
    codes.push("SENSITIVITY_NOT_ACKNOWLEDGED");
    reasons.push("Sensitivity flags present require acknowledgment");
  }

  if (codes.length > 0) {
    return {
      ok: false,
      readiness_status: "needs_input",
      codes,
      reasons,
    };
  }

  if (!bundle.confirmed_by_user) {
    return {
      ok: true,
      readiness_status: "awaiting_confirmation",
      codes: [],
      reasons: ["Bundle is ready for user confirmation"],
    };
  }

  return {
    ok: true,
    readiness_status: "ready_to_dispatch",
    codes: [],
    reasons: ["Bundle is ready to dispatch"],
  };
}
