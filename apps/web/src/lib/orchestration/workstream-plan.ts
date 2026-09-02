/**
 * Workstream plan helpers — ADR-006.v2 Mission Decomposer contract.
 * Cite: docs/MISSION_DECOMPOSER_CONTRACT.md, Architecture Contract §4.
 *
 * Router/Dispatcher remain HELD. These helpers validate decomposition only.
 */

import type { Workstream, WorkstreamPlan } from "@/lib/schemas/workstream";
import {
  WorkstreamPlanSchema,
  WorkstreamSchema,
} from "@/lib/schemas/workstream";

export { WorkstreamPlanSchema, WorkstreamSchema };
export type { Workstream, WorkstreamPlan };

type OkResult = { ok: true };
type FailResult = { ok: false; reason: string };
type CheckResult = OkResult | FailResult;

const GENERIC_TITLE_RE =
  /^(understand|clarify)\s+(the\s+)?(scope|requirements?|mission)|create\s+(the\s+)?(main|final)\s+(output|deliverable)|do\s+the\s+work|execute:\s*do\s+the\s+mission|generic\s+workstream|complete\s+the\s+mission/i;

/**
 * Validates a plan against ADR-006.v2 schema.
 */
export function parseWorkstreamPlan(input: unknown): WorkstreamPlan {
  return WorkstreamPlanSchema.parse(input);
}

export function parseWorkstream(input: unknown): Workstream {
  return WorkstreamSchema.parse(input);
}

/**
 * Rejects placeholder titles that do not reflect domain work.
 * `allowClarify` — only for domain=unknown clarifying workstreams.
 */
export function assertNonGenericWorkstreamTitles(
  workstreams: Array<{ title: string }>,
  options?: { allowClarify?: boolean },
): CheckResult {
  for (const ws of workstreams) {
    const title = ws.title.trim();
    if (options?.allowClarify && /^clarify\b/i.test(title)) {
      continue;
    }
    if (GENERIC_TITLE_RE.test(title)) {
      return {
        ok: false,
        reason: `Generic placeholder workstream title not allowed: "${title}"`,
      };
    }
  }
  return { ok: true };
}

/**
 * Structural check: objective, expected_output.description, and acceptance_criteria
 * must be present whenever required_capabilities are listed (work-first rule).
 */
export function assertCapabilitiesFollowWork(
  workstreams: Array<{
    workstream_id: string;
    objective: string;
    expected_output: { description: string };
    acceptance_criteria: string[];
    required_capabilities: string[];
  }>,
): CheckResult {
  for (const ws of workstreams) {
    if (
      !ws.objective.trim() ||
      !ws.expected_output.description.trim() ||
      ws.acceptance_criteria.length === 0
    ) {
      return {
        ok: false,
        reason: `Workstream ${ws.workstream_id} missing concrete work definition before capabilities`,
      };
    }
    if (ws.required_capabilities.length === 0) {
      return {
        ok: false,
        reason: `Workstream ${ws.workstream_id} has no required_capabilities after work definition`,
      };
    }
  }
  return { ok: true };
}

/**
 * When integration_required, exactly one is_integration_workstream must exist
 * and must depend on upstream work when multiple WS exist.
 */
export function assertIntegrationRule(plan: {
  integration_required: boolean;
  workstreams: Array<{
    workstream_id: string;
    dependencies: string[];
    is_integration_workstream: boolean;
  }>;
}): CheckResult {
  const integrators = plan.workstreams.filter((w) => w.is_integration_workstream);
  if (plan.integration_required) {
    if (integrators.length !== 1) {
      return {
        ok: false,
        reason: `integration_required=true expects exactly one is_integration_workstream, got ${integrators.length}`,
      };
    }
    const integ = integrators[0]!;
    if (!integ.dependencies.length && plan.workstreams.length > 1) {
      return {
        ok: false,
        reason: `Integration workstream ${integ.workstream_id} must depend on upstream workstreams`,
      };
    }
  } else if (integrators.length > 0) {
    return {
      ok: false,
      reason: "is_integration_workstream set but integration_required=false",
    };
  }
  return { ok: true };
}

/**
 * DAG check on workstream dependencies (cycle detection via Kahn).
 */
export function assertAcyclicDependencies(
  workstreams: Array<{ workstream_id: string; dependencies: string[] }>,
): CheckResult {
  const ids = new Set(workstreams.map((w) => w.workstream_id));
  for (const w of workstreams) {
    for (const dep of w.dependencies) {
      if (!ids.has(dep)) {
        return {
          ok: false,
          reason: `Unknown dependency ${dep} on workstream ${w.workstream_id}`,
        };
      }
    }
  }

  const indegree = new Map<string, number>();
  for (const w of workstreams) {
    indegree.set(w.workstream_id, w.dependencies.length);
  }

  const queue = workstreams
    .filter((w) => (indegree.get(w.workstream_id) ?? 0) === 0)
    .map((w) => w.workstream_id);
  let visited = 0;

  while (queue.length > 0) {
    const id = queue.shift()!;
    visited += 1;
    for (const w of workstreams) {
      if (w.dependencies.includes(id)) {
        const next = (indegree.get(w.workstream_id) ?? 0) - 1;
        indegree.set(w.workstream_id, next);
        if (next === 0) queue.push(w.workstream_id);
      }
    }
  }

  if (visited !== workstreams.length) {
    return { ok: false, reason: "Workstream dependency cycle detected" };
  }
  return { ok: true };
}

/**
 * Full ADR-006.v2 structural checks (schema + anti-generic + integration + DAG).
 */
export function assertValidDecomposition(plan: WorkstreamPlan): CheckResult {
  WorkstreamPlanSchema.parse(plan);
  const titles = assertNonGenericWorkstreamTitles(plan.workstreams, {
    allowClarify: plan.domain === "unknown",
  });
  if (!titles.ok) return titles;
  const caps = assertCapabilitiesFollowWork(plan.workstreams);
  if (!caps.ok) return caps;
  const integ = assertIntegrationRule(plan);
  if (!integ.ok) return integ;
  return assertAcyclicDependencies(plan.workstreams);
}

/**
 * Topological order of workstreams by dependencies (Kahn).
 * Throws if a cycle or unknown dependency id is present.
 */
export function topologicalSortWorkstreams(
  workstreams: Workstream[],
): Workstream[] {
  const dag = assertAcyclicDependencies(workstreams);
  if (!dag.ok) {
    throw new Error(dag.reason);
  }

  const byId = new Map(workstreams.map((w) => [w.workstream_id, w]));
  const indegree = new Map<string, number>();
  for (const w of workstreams) {
    indegree.set(w.workstream_id, w.dependencies.length);
  }

  const queue = workstreams
    .filter((w) => (indegree.get(w.workstream_id) ?? 0) === 0)
    .map((w) => w.workstream_id);
  const ordered: Workstream[] = [];

  while (queue.length > 0) {
    const id = queue.shift()!;
    ordered.push(byId.get(id)!);
    for (const w of workstreams) {
      if (w.dependencies.includes(id)) {
        const next = (indegree.get(w.workstream_id) ?? 0) - 1;
        indegree.set(w.workstream_id, next);
        if (next === 0) queue.push(w.workstream_id);
      }
    }
  }

  return ordered;
}
