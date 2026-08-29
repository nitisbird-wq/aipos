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
  routing_mode: "KEEP" | "ASSIST" | "HANDOFF" | "SPLIT" | "HUMAN_REQUIRED";
  coverage: Array<{ requirement: string; capabilities: string[]; operators: string[] }>;
  explanation: string[];
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

const NON_ROUTABLE_CAPABILITY_STATES = new Set([
  "UNVALIDATED",
  "UNVERIFIED",
  "UNAVAILABLE",
  "REVERIFY_REQUIRED",
  "DEGRADED",
]);

function capabilityIsRoutable(capability: Capability): boolean {
  const state = capability.status?.trim().toUpperCase();
  return capability.enabled !== false && (!state || !NON_ROUTABLE_CAPABILITY_STATES.has(state));
}

function operatorsForCapability(capability: Capability): string[] {
  const rows = capability.specialists ?? [];
  return rows
    .map((row) => {
      if (typeof row !== "object" || !row) return "";
      const specialist = row as {
        specialist?: string;
        specialist_id?: string;
        enabled?: boolean;
      };
      if (specialist.enabled === false) return "";
      return specialist.specialist ?? specialist.specialist_id ?? "";
    })
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
  current_operator?: string;
}): RoutingDecision {
  const coverage = input.required_capabilities.map((requirement) => {
    const capabilities = input.capabilities.filter(
      (capability) =>
        capabilityIsRoutable(capability) &&
        (requirement === capability.family ||
          requirement.startsWith(`${capability.family}.`) ||
          capability.family.startsWith(requirement)),
    );
    return {
      requirement,
      capabilities: capabilities.map((capability) => capability.name),
      operators: Array.from(new Set(capabilities.flatMap(operatorsForCapability))),
      rows: capabilities,
    };
  });
  const missing = coverage.filter((row) => row.capabilities.length === 0 || row.operators.length === 0);
  const authority = evaluateAuthorityDecision({
    proposed_action: input.task,
    risk_level: input.risk_level,
    reversible: input.reversible ?? true,
    delegated: input.delegated ?? missing.length === 0,
  });

  if (missing.length > 0) {
    return {
      task: input.task,
      required_capabilities: input.required_capabilities,
      eligible_operators: [],
      primary: "HUMAN",
      support: [],
      tools: [],
      authority,
      output: "UNMET_CAPABILITY",
      routing_mode: "HUMAN_REQUIRED",
      coverage: coverage.map(({ requirement, capabilities, operators }) => ({
        requirement,
        capabilities,
        operators,
      })),
      explanation: missing.map(
        (row) => `No verified routable operator covers ${row.requirement}`,
      ),
    };
  }

  const matched = Array.from(new Set(coverage.flatMap((row) => row.rows)));
  const eligible = Array.from(new Set(coverage.flatMap((row) => row.operators)));
  const common = eligible.filter((operator) =>
    coverage.every((row) => row.operators.includes(operator)),
  );
  const primary = common[0] ?? eligible[0] ?? "HUMAN";
  const support = eligible.filter((operator) => operator !== primary).slice(0, 3);
  const hasPartial = matched.some(
    (capability) => capability.status?.trim().toUpperCase() === "PARTIAL",
  );

  let routingMode: RoutingDecision["routing_mode"];
  if (input.current_operator && !eligible.includes(input.current_operator)) {
    routingMode = "HANDOFF";
  } else if (common.length === 0 && coverage.length > 1) {
    routingMode = "SPLIT";
  } else if (hasPartial || support.length > 0) {
    routingMode = "ASSIST";
  } else {
    routingMode = "KEEP";
  }

  return {
    task: input.task,
    required_capabilities: input.required_capabilities,
    eligible_operators: eligible,
    primary,
    support,
    tools: matched.map((capability) => capability.name),
    authority,
    output: primary === "HUMAN" ? "HUMAN" : "ROUTED",
    routing_mode: routingMode,
    coverage: coverage.map(({ requirement, capabilities, operators }) => ({
      requirement,
      capabilities,
      operators,
    })),
    explanation: [
      `All ${coverage.length} required capability families have routable coverage`,
      `Selected ${primary} as primary`,
      routingMode === "SPLIT"
        ? "No single operator covers every requirement; split by capability"
        : `Routing mode ${routingMode} is the least disruptive verified fit`,
    ],
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
