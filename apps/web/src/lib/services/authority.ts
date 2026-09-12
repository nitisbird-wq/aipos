import {
  AuthorityActionSchema,
  AuthorityDecisionSchema,
  type AuthorityDecision,
} from "@/lib/schemas/contracts";

export function evaluateAuthorityDecision(input: {
  proposed_action: string;
  reversible: boolean;
  delegated: boolean;
  risk_level: "L0" | "L1" | "L2" | "L3" | "L4";
}): AuthorityDecision {
  const action = AuthorityActionSchema.parse(input);
  if (action.risk_level === "L0" || action.risk_level === "L1") {
    return AuthorityDecisionSchema.parse({
      decision: "AUTO_AUTHORIZE",
      reason: "Low risk action under automatic policy",
    });
  }

  if (action.risk_level === "L2") {
    if (action.reversible && action.delegated) {
      return AuthorityDecisionSchema.parse({
        decision: "AUTO_AUTHORIZE",
        reason: "L2 action is reversible and delegated",
      });
    }
    return AuthorityDecisionSchema.parse({
      decision: "HUMAN_GATE",
      reason: "L2 action is consequential without reversible delegated guardrail",
    });
  }

  return AuthorityDecisionSchema.parse({
    decision: "HUMAN_GATE",
    reason: "L3/L4 always require explicit human approval",
  });
}
