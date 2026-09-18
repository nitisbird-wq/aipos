import { z } from "zod";
import { getPlanReviewState, approvePlanWorkstream, editPlanWorkstream } from "./mission-plan";
import type { PlanReviewState } from "@/lib/schemas/contracts";

export const WorkstreamDecisionSchema = z.object({
  workstream_id: z.string().min(1),
  decision: z.enum(["APPROVE", "EDIT", "REJECT_REGENERATE"]),
  edit_notes: z.string().optional(),
  title: z.string().optional(),
  objective: z.string().optional(),
  proposed_actions: z.array(z.string()).optional(),
  execution_steps: z.array(z.string()).optional(),
  proposed_worker: z.string().optional(),
  proposed_tools: z.array(z.string()).optional(),
  evidence_requirements: z.array(z.string()).optional(),
  acceptance_criteria: z.array(z.string().min(1)).optional(),
  recovery_strategy: z.string().optional(),
});
export type WorkstreamDecision = z.infer<typeof WorkstreamDecisionSchema>;

export const DecisionBundleSchema = z.object({
  mission_id: z.string().min(1),
  plan_version: z.string().min(1),
  submitted_at: z.string().datetime(),
  decisions: z.array(WorkstreamDecisionSchema).min(1),
});
export type DecisionBundle = z.infer<typeof DecisionBundleSchema>;

export type DecisionVerification = {
  workstream_id: string;
  decision: "APPROVE" | "EDIT" | "REJECT_REGENERATE";
  applied: boolean;
  final_state: string;
  error?: string;
};

export type ApplyDecisionsResult = {
  ok: boolean;
  mission_id: string;
  applied: number;
  failed: number;
  verifications: DecisionVerification[];
  canonical_plan: PlanReviewState;
};

export async function applyDecisionBundle(
  bundle: DecisionBundle,
  actor: string,
): Promise<ApplyDecisionsResult> {
  const parsed = DecisionBundleSchema.parse(bundle);
  const { mission_id, plan_version, decisions } = parsed;

  const currentPlan = await getPlanReviewState(mission_id);
  if (!currentPlan) throw new Error("PLAN_NOT_FOUND");

  // Fail closed on stale plan
  if (currentPlan.updated_at !== plan_version) {
    throw new Error(
      `PLAN_STALE: bundle plan_version=${plan_version} != current updated_at=${currentPlan.updated_at}`,
    );
  }

  // Validate all workstream_ids exist
  const wsMap = new Map(currentPlan.workstreams.map((ws) => [ws.workstream_id, ws]));
  for (const d of decisions) {
    if (!wsMap.has(d.workstream_id)) throw new Error(`WORKSTREAM_NOT_FOUND: ${d.workstream_id}`);
  }

  // Validate dependency integrity: cannot APPROVE if any dependency stays PROPOSED
  const bundleApproves = new Set(
    decisions.filter((d) => d.decision === "APPROVE").map((d) => d.workstream_id),
  );
  for (const d of decisions) {
    if (d.decision !== "APPROVE") continue;
    const ws = wsMap.get(d.workstream_id)!;
    for (const depId of ws.dependencies) {
      const dep = wsMap.get(depId);
      if (!dep) continue;
      const depAlreadyApproved =
        dep.approval_state === "APPROVED" || dep.approval_state === "DISPATCHABLE";
      if (!depAlreadyApproved && !bundleApproves.has(depId)) {
        throw new Error(
          `DEPENDENCY_NOT_APPROVED: ${d.workstream_id} depends on ${depId} which will remain PROPOSED`,
        );
      }
    }
  }

  // Apply in execution_order to respect dependency sequencing
  const orderedDecisions = [...decisions].sort((a, b) => {
    const oA = wsMap.get(a.workstream_id)?.execution_order ?? 0;
    const oB = wsMap.get(b.workstream_id)?.execution_order ?? 0;
    return oA - oB;
  });

  const verifications: DecisionVerification[] = [];

  for (const d of orderedDecisions) {
    const originalState = wsMap.get(d.workstream_id)!.approval_state;
    try {
      if (d.decision === "APPROVE") {
        await approvePlanWorkstream(mission_id, d.workstream_id, actor);
        verifications.push({
          workstream_id: d.workstream_id,
          decision: d.decision,
          applied: true,
          final_state: "APPROVED",
        });
      } else if (d.decision === "EDIT") {
        const patch: Record<string, unknown> = {};
        if (d.edit_notes !== undefined) patch.owner_notes = d.edit_notes;
        if (d.title !== undefined) patch.title = d.title;
        if (d.objective !== undefined) patch.objective = d.objective;
        if (d.proposed_actions !== undefined) patch.proposed_actions = d.proposed_actions;
        if (d.execution_steps !== undefined) patch.execution_steps = d.execution_steps;
        if (d.proposed_worker !== undefined) patch.proposed_worker = d.proposed_worker;
        if (d.proposed_tools !== undefined) patch.proposed_tools = d.proposed_tools;
        if (d.evidence_requirements !== undefined)
          patch.evidence_requirements = d.evidence_requirements;
        if (d.acceptance_criteria !== undefined) patch.acceptance_criteria = d.acceptance_criteria;
        if (d.recovery_strategy !== undefined) patch.recovery_strategy = d.recovery_strategy;
        await editPlanWorkstream(mission_id, d.workstream_id, patch, actor);
        verifications.push({
          workstream_id: d.workstream_id,
          decision: d.decision,
          applied: true,
          final_state: "PROPOSED",
        });
      } else {
        // REJECT_REGENERATE → reset to PROPOSED with rejection note
        await editPlanWorkstream(
          mission_id,
          d.workstream_id,
          { owner_notes: `REJECTED: ${d.edit_notes ?? "Owner requested regeneration"}` },
          actor,
        );
        verifications.push({
          workstream_id: d.workstream_id,
          decision: d.decision,
          applied: true,
          final_state: "PROPOSED",
        });
      }
    } catch (err) {
      verifications.push({
        workstream_id: d.workstream_id,
        decision: d.decision,
        applied: false,
        final_state: originalState,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  // Readback canonical state and verify
  const finalPlan = await getPlanReviewState(mission_id);
  if (!finalPlan) throw new Error("PLAN_NOT_FOUND_AFTER_APPLY");

  const finalWsMap = new Map(finalPlan.workstreams.map((ws) => [ws.workstream_id, ws]));
  for (const v of verifications) {
    if (!v.applied) continue;
    const ws = finalWsMap.get(v.workstream_id);
    if (!ws) {
      v.applied = false;
      v.error = "WORKSTREAM_MISSING_AFTER_APPLY";
      continue;
    }
    v.final_state = ws.approval_state;
    if (
      v.decision === "APPROVE" &&
      ws.approval_state !== "APPROVED" &&
      ws.approval_state !== "DISPATCHABLE"
    ) {
      v.applied = false;
      v.error = `READBACK_MISMATCH: expected APPROVED|DISPATCHABLE got ${ws.approval_state}`;
    }
  }

  const failed = verifications.filter((v) => !v.applied).length;
  return {
    ok: failed === 0,
    mission_id,
    applied: verifications.filter((v) => v.applied).length,
    failed,
    verifications,
    canonical_plan: finalPlan,
  };
}
