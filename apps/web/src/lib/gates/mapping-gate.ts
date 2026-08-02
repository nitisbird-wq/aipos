import type { IntakeMissionBundle } from "@/lib/schemas/intake";
import type { MappingRejectCode } from "@/lib/schemas/policy";
import { evaluateHandling } from "./handling-gate";
import { evaluateReadiness } from "./readiness-gate";

export type MappingGateResult =
  | { ok: true; reasons: string[]; policy_result: Record<string, unknown> }
  | {
      ok: false;
      code: MappingRejectCode;
      message: string;
      reasons: string[];
      policy_result: Record<string, unknown>;
    };

/**
 * Mapping Gate — all conditions must pass before Bundle → Mission Object.
 */
export function evaluateMapping(bundle: IntakeMissionBundle): MappingGateResult {
  const reasons: string[] = [];

  if (!bundle.confirmed_by_user) {
    return reject("INTAKE_NOT_CONFIRMED", "Intake has not been confirmed by user", reasons);
  }

  if (bundle.readiness_status !== "ready_to_dispatch") {
    return reject(
      "READINESS_NOT_READY",
      `readiness_status must be ready_to_dispatch (got ${bundle.readiness_status})`,
      reasons,
    );
  }

  const readiness = evaluateReadiness({
    ...bundle,
    // readiness after confirm should still satisfy structural fields
  });
  if (!readiness.ok || readiness.readiness_status === "needs_input") {
    if (readiness.codes.includes("MISSING_SUCCESS_CRITERIA")) {
      return reject("MISSING_SUCCESS_CRITERIA", readiness.reasons.join("; "), readiness.codes);
    }
    if (readiness.codes.includes("UNRESOLVED_BLOCKER")) {
      return reject("UNRESOLVED_BLOCKER", readiness.reasons.join("; "), readiness.codes);
    }
    if (readiness.codes.includes("MISSING_DESIRED_OUTCOME")) {
      return reject("MISSING_DESIRED_OUTCOME", readiness.reasons.join("; "), readiness.codes);
    }
    if (readiness.codes.includes("MISSING_OPERATIONAL_RISK")) {
      return reject("MISSING_OPERATIONAL_RISK", readiness.reasons.join("; "), readiness.codes);
    }
  }

  const unresolved = bundle.missing_blockers.filter((b) => b.blocking && !b.resolved);
  if (unresolved.length > 0) {
    return reject(
      "UNRESOLVED_BLOCKER",
      `Unresolved blockers: ${unresolved.map((b) => b.code).join(", ")}`,
      unresolved.map((b) => b.code),
    );
  }

  if (!bundle.desired_outcome?.trim()) {
    return reject("MISSING_DESIRED_OUTCOME", "desired_outcome is required", reasons);
  }

  if (!bundle.success_criteria || bundle.success_criteria.length < 1) {
    return reject(
      "MISSING_SUCCESS_CRITERIA",
      "At least one success criterion is required",
      reasons,
    );
  }

  if (!bundle.operational_risk) {
    return reject("MISSING_OPERATIONAL_RISK", "operational_risk is required", reasons);
  }

  for (const dest of bundle.data_destinations) {
    if (dest.system === "none") {
      return reject("DATA_DESTINATION_NOT_APPROVED", "system=none is forbidden", [
        "FORBIDDEN_DESTINATION_NONE",
      ]);
    }
  }

  const approved = new Set(["intake_channel", "notion", "app_db"]);
  const unapproved = bundle.data_destinations.filter((d) => !approved.has(d.system));
  if (unapproved.length > 0) {
    return reject(
      "DATA_DESTINATION_NOT_APPROVED",
      `Unapproved destinations: ${unapproved.map((d) => d.system).join(", ")}`,
      unapproved.map((d) => d.system),
    );
  }

  const handling = evaluateHandling(bundle);
  if (!handling.ok) {
    return {
      ok: false,
      code: "HANDLING_GATE_FAILED",
      message: handling.reasons.join("; "),
      reasons: handling.reasons,
      policy_result: {
        gate: "mapping",
        handling,
        readiness,
      },
    };
  }

  return {
    ok: true,
    reasons: ["Mapping Gate passed"],
    policy_result: {
      gate: "mapping",
      handling,
      readiness,
    },
  };
}

function reject(code: MappingRejectCode, message: string, reasons: string[]): MappingGateResult {
  return {
    ok: false,
    code,
    message,
    reasons: reasons.length ? reasons : [message],
    policy_result: { gate: "mapping", code, message },
  };
}
