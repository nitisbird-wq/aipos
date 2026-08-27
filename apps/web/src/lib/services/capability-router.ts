import type { Capability } from "@/lib/schemas/policy";
import { evaluateAuthorityDecision } from "@/lib/services/authority";
import type { AuthorityDecision } from "@/lib/schemas/contracts";

export type RoutingDecision = {
  task: string;
  required_capabilities: string[];
  eligible_operators: string[];
  primary: string;
  support: string[];
  tools: string[];
  authority: AuthorityDecision;
  output: "ROUTED" | "UNMET_CAPABILITY" | "HUMAN";
};

/**
 * Operator abstraction — workers expose a uniform handle.
 * Supervisor routes tasks to operators; operators never own consequential approval.
 */
export type OperatorHandle = {
  id: string;
  dispatch: (payload: Record<string, unknown>) => Promise<{ run_id: string; status: "QUEUED" }>;
  status: (runId: string) => Promise<"QUEUED" | "RUNNING" | "PASSED" | "FAILED" | "BLOCKED">;
  result: (runId: string) => Promise<Record<string, unknown> | null>;
  evidence: (runId: string) => Promise<string[]>;
  error: (runId: string) => Promise<string | null>;
};

function operatorsForCapability(capability: Capability): string[] {
  const rows = capability.specialists ?? [];
  return rows
    .map((row) =>
      typeof row === "object" && row ? (row as { specialist?: string }).specialist : "",
    )
    .filter((row): row is string => Boolean(row));
}

/**
 * Route TASK → REQUIRED CAPABILITIES → ELIGIBLE OPERATORS → PRIMARY/SUPPORT/TOOLS → AUTHORITY → OUTPUT.
 * Do not distort task to fit available operator.
 */
export function routeCapabilities(input: {
  task: string;
  required_capabilities: string[];
  capabilities: Capability[];
  risk_level: "L0" | "L1" | "L2" | "L3" | "L4";
  reversible?: boolean;
  delegated?: boolean;
}): RoutingDecision {
  const matched = input.capabilities.filter(
    (cap) =>
      cap.enabled !== false &&
      input.required_capabilities.some(
        (req) =>
          req === cap.family || req.startsWith(`${cap.family}.`) || cap.family.startsWith(req),
      ),
  );

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

export function createStubOperator(id: string): OperatorHandle {
  const runs = new Map<
    string,
    {
      status: "QUEUED" | "RUNNING" | "PASSED" | "FAILED" | "BLOCKED";
      result: Record<string, unknown> | null;
      evidence: string[];
      error: string | null;
    }
  >();

  return {
    id,
    async dispatch(payload) {
      const run_id = `RUN-${id}-${runs.size + 1}`;
      runs.set(run_id, {
        status: "QUEUED",
        result: payload,
        evidence: [],
        error: null,
      });
      return { run_id, status: "QUEUED" };
    },
    async status(runId) {
      return runs.get(runId)?.status ?? "FAILED";
    },
    async result(runId) {
      return runs.get(runId)?.result ?? null;
    },
    async evidence(runId) {
      return runs.get(runId)?.evidence ?? [];
    },
    async error(runId) {
      return runs.get(runId)?.error ?? (runs.has(runId) ? null : "RUN_NOT_FOUND");
    },
  };
}
