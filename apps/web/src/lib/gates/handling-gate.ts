import type { IntakeMissionBundle } from "@/lib/schemas/intake";

export type HandlingGateResult = {
  ok: boolean;
  code?: "HANDLING_GATE_FAILED";
  reasons: string[];
  requirements: string[];
  policy_refs: string[];
};

const APPROVED_SYSTEMS = new Set(["intake_channel", "notion", "app_db"]);

/**
 * Handling Gate — limits how sensitive data is read, stored, sent, processed.
 * Sensitivity ≠ automatic Authority Approval; flags must still pass handling.
 */
export function evaluateHandling(bundle: IntakeMissionBundle): HandlingGateResult {
  const reasons: string[] = [];
  const requirements = [...bundle.data_handling_requirements];
  const policy_refs = ["AIPOS-GOV-002", "AIPOS-GOV-006"];

  for (const dest of bundle.data_destinations) {
    if (dest.system === "none") {
      reasons.push("Forbidden destination system=none");
    }
    if (!APPROVED_SYSTEMS.has(dest.system)) {
      reasons.push(`Unapproved data destination: ${dest.system}`);
    }
  }

  if (bundle.sensitivity_flags.length > 0) {
    if (!bundle.sensitivity_acknowledged) {
      reasons.push("Sensitivity flags require user acknowledgment");
    }
    if (!requirements.includes("redact_in_audit_display")) {
      requirements.push("redact_in_audit_display");
    }
    if (!requirements.includes("references_over_payloads")) {
      requirements.push("references_over_payloads");
    }

    // Notion Mission Registry allow-list sync is permitted in Intake MVP when
    // acknowledged; other external transfers still require Authority Approval.
    const hasExternal = bundle.data_destinations.some(
      (d) => d.external_transfer && !(d.system === "notion" && d.purpose === "mission_registry"),
    );
    if (hasExternal) {
      reasons.push(
        "External transmission of sensitive data requires Authority Approval (not auto-granted in Intake MVP)",
      );
      policy_refs.push("AIPOS-GOV-001");
    }

    const highSensitivity = bundle.sensitivity_flags.some((f) =>
      ["credentials", "police_case_data", "legal_privileged", "minors", "health"].includes(f),
    );
    if (highSensitivity && !requirements.includes("minimize_retention")) {
      requirements.push("minimize_retention");
    }
  }

  // Chat-only must use intake_channel
  const chatOnly = bundle.data_destinations.find((d) => d.purpose === "chat_only");
  if (chatOnly && chatOnly.system !== "intake_channel") {
    reasons.push("Chat-only purpose must use system=intake_channel");
  }

  if (reasons.length > 0) {
    return {
      ok: false,
      code: "HANDLING_GATE_FAILED",
      reasons,
      requirements,
      policy_refs,
    };
  }

  return {
    ok: true,
    reasons: ["Handling Gate passed"],
    requirements,
    policy_refs,
  };
}
