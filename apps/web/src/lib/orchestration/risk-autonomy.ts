import type {
  AutonomyClass,
  DispatchAction,
  RoutingBlockCode,
  WorkstreamRisk,
} from "@/lib/schemas/workstream";

export type RiskAutonomyInput = {
  risk_level: WorkstreamRisk;
  required_capabilities: string[];
  has_unknown_capability?: boolean;
  has_eligible_verified_operator?: boolean;
  authority_known?: boolean;
  reversible?: boolean;
  within_delegated_authority?: boolean;
  involves_secrets?: boolean;
  involves_production_change?: boolean;
  involves_merge_or_deploy?: boolean;
  irreversible?: boolean;
  sensitive_external_write?: boolean;
};

export type RiskAutonomyResult = {
  autonomy_class: AutonomyClass;
  approval_required: boolean;
  dispatch_action: DispatchAction;
  block_codes: RoutingBlockCode[];
  approval_reason: string | null;
  policy_version: "ADR-006.D-006.4";
};

function isDomainCapability(capabilityId: string): boolean {
  return capabilityId.startsWith("domain.");
}

/**
 * ADR-006 D-006.4 — risk-based autonomy.
 * Phase 1 Mission CONFIRM is the only Mission approval; no mandatory G-Plan.
 */
export function evaluateRiskAutonomy(input: RiskAutonomyInput): RiskAutonomyResult {
  const block_codes: RoutingBlockCode[] = [];
  const policy_version = "ADR-006.D-006.4" as const;

  if (input.has_unknown_capability) {
    block_codes.push("UNKNOWN_CAPABILITY");
  }
  if (input.authority_known === false) {
    block_codes.push("UNKNOWN_AUTHORITY");
  }
  if (input.has_eligible_verified_operator === false) {
    block_codes.push("NO_ELIGIBLE_OPERATOR");
  }
  if (input.required_capabilities.some(isDomainCapability)) {
    block_codes.push("DOMAIN_CAPABILITY_UNVALIDATED");
  }
  if (input.involves_secrets || input.involves_production_change) {
    block_codes.push("SECRETS_OR_PRODUCTION_CHANGE");
  }
  if (input.involves_merge_or_deploy) {
    block_codes.push("MERGE_OR_DEPLOY");
  }
  if (input.irreversible) {
    block_codes.push("IRREVERSIBLE_ACTION");
  }
  if (input.sensitive_external_write) {
    block_codes.push("SENSITIVE_EXTERNAL_WRITE");
  }

  const failClosed =
    block_codes.includes("UNKNOWN_CAPABILITY") ||
    block_codes.includes("UNKNOWN_AUTHORITY") ||
    block_codes.includes("NO_ELIGIBLE_OPERATOR");

  if (failClosed) {
    return {
      autonomy_class: "fail_closed",
      approval_required: true,
      dispatch_action: "block",
      block_codes,
      approval_reason: "Fail closed: unknown capability, operator, or authority",
      policy_version,
    };
  }

  const hardHuman =
    block_codes.includes("DOMAIN_CAPABILITY_UNVALIDATED") ||
    block_codes.includes("SECRETS_OR_PRODUCTION_CHANGE") ||
    block_codes.includes("MERGE_OR_DEPLOY") ||
    block_codes.includes("IRREVERSIBLE_ACTION") ||
    block_codes.includes("SENSITIVE_EXTERNAL_WRITE") ||
    input.risk_level === "L3" ||
    input.risk_level === "L4";

  if (hardHuman) {
    if (input.risk_level === "L3" || input.risk_level === "L4") {
      block_codes.push("RISK_REQUIRES_HUMAN");
    }
    return {
      autonomy_class: "require_human",
      approval_required: true,
      dispatch_action: "await_human",
      block_codes: Array.from(new Set(block_codes)),
      approval_reason: "Explicit Human Approval required (D-006.4)",
      policy_version,
    };
  }

  if (input.risk_level === "L0" || input.risk_level === "L1") {
    return {
      autonomy_class: "auto_dispatch",
      approval_required: false,
      dispatch_action: "dispatch_now",
      block_codes: [],
      approval_reason: null,
      policy_version,
    };
  }

  // L2
  if (input.reversible === true && input.within_delegated_authority === true) {
    return {
      autonomy_class: "auto_if_reversible",
      approval_required: false,
      dispatch_action: "dispatch_now",
      block_codes: [],
      approval_reason: null,
      policy_version,
    };
  }

  block_codes.push("RISK_REQUIRES_HUMAN");
  return {
    autonomy_class: "require_human",
    approval_required: true,
    dispatch_action: "await_human",
    block_codes: Array.from(new Set(block_codes)),
    approval_reason: "L2 requires Human Gate unless reversible and within delegated authority",
    policy_version,
  };
}
