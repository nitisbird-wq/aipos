import { z } from "zod";
import { WorkstreamSchema } from "@/lib/schemas/workstream";

/**
 * Mission Decomposer output (ADR-006).
 * Produced after Phase 2 parent dispatch; does not replace Phase 1 CONFIRM.
 */
export const WorkstreamPlanSchema = z.object({
  plan_id: z.string().min(1),
  mission_id: z.string().regex(/^MIS-[0-9]+$/),
  parent_linear_issue: z.string().min(1),
  notion_mission_page_id: z.string().nullable().optional(),
  plan_version: z.number().int().min(1),
  mission_risk_level: z.enum(["L0", "L1", "L2", "L3", "L4"]),
  workstreams: z.array(WorkstreamSchema).min(1),
  parallel_groups: z.array(z.string()).optional(),
  correlation_id: z.string().min(1),
  created_at: z.string(),
  decomposer_version: z.literal("ADR-006.v1"),
});

export type WorkstreamPlan = z.infer<typeof WorkstreamPlanSchema>;

export function assertAcyclicDependencies(
  workstreams: Array<{ workstream_id: string; dependencies: string[] }>,
): { ok: true } | { ok: false; cycle: string[] } {
  const byId = new Map(workstreams.map((w) => [w.workstream_id, w.dependencies]));
  const visiting = new Set<string>();
  const visited = new Set<string>();
  const stack: string[] = [];

  function dfs(id: string): string[] | null {
    if (visiting.has(id)) return [...stack, id];
    if (visited.has(id)) return null;
    visiting.add(id);
    stack.push(id);
    for (const dep of byId.get(id) ?? []) {
      if (!byId.has(dep)) continue;
      const cycle = dfs(dep);
      if (cycle) return cycle;
    }
    stack.pop();
    visiting.delete(id);
    visited.add(id);
    return null;
  }

  for (const id of byId.keys()) {
    const cycle = dfs(id);
    if (cycle) return { ok: false, cycle };
  }
  return { ok: true };
}
