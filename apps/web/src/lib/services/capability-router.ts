import type { Capability } from "@/lib/schemas/policy";
import { evaluateAuthorityDecision } from "@/lib/services/authority";

export type RoutingDecision = {
  task: string;
  required_capabilities: string[];
  eligible_operators: string[];
  primary: string;
  support: string[];
  tools: string[];
  authority: ReturnType<typeof evaluateAuthorityDecision>;
  output: "ROUTED" | "UNMET_CAPABILITY" | "HUMAN";
};

function operatorsForCapability(capability: Capability): string[] {
  const rows = capability.specialists ?? [];
  return rows
    .map((row) => (typeof row === "object" && row ? (row as { specialist?: string }).specialist : ""))
    .filter((row): row is string => Boolean(row));
}

export function routeCapabilities(input: {
  task: string;
  required_capabilities: string[];
  capabilities: Capability[];
  risk_level: "L0" | "L1" | "L2" | "L3" | "L4";
  reversible?: boolean;
  delegated?: boolean;
}): RoutingDecision {
  const matched = input.capabilities.filter((cap) => input.required_capabilities.includes(cap.family));
  if (matched.length === 0) {
    return {
      task: input.task,
      required_capabilities: input.required_capabilities,
      eligible_operators: [],
      primary: "HUMAN",
      support: [],
      tools: [],
      authority: evaluateAuthorityDecision({
        proposed_action: input.task,
        risk_level: input.risk_level,
        reversible: input.reversible ?? true,
        delegated: input.delegated ?? false,
      }),
      output: "UNMET_CAPABILITY",
    };
  }

  const eligible = Array.from(new Set(matched.flatMap(operatorsForCapability)));
  const primary = eligible[0] ?? "HUMAN";
  const support = eligible.slice(1, 3);
  const tools = matched.map((m) => m.name);
  const authority = evaluateAuthorityDecision({
    proposed_action: input.task,
    risk_level: input.risk_level,
    reversible: input.reversible ?? true,
    delegated: input.delegated ?? true,
  });

  return {
    task: input.task,
    required_capabilities: input.required_capabilities,
    eligible_operators: eligible,
    primary,
    support,
    tools,
    authority,
    output: primary === "HUMAN" ? "HUMAN" : "ROUTED",
  };
}
