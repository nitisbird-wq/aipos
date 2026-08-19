import { nowIso } from "@/lib/ids";
import type { AnalyzeResult } from "@/lib/services/analyze";
import {
  ContextObjectSchema,
  DeliverableContractSchema,
  MissionContextPackSchema,
  MissionStrategySchema,
  type ContextObject,
  type DeliverableContract,
  type MissionContextPack,
  type MissionStrategy,
} from "@/lib/schemas/contracts";

function inferPlaybook(capabilities: string[]): string {
  if (capabilities.some((c) => c.includes("debug"))) return "debug";
  if (capabilities.some((c) => c.includes("automation"))) return "automation";
  if (capabilities.some((c) => c.includes("research"))) return "research";
  if (capabilities.some((c) => c.includes("knowledge"))) return "knowledge_organization";
  if (capabilities.some((c) => c.includes("business"))) return "business_launch";
  if (capabilities.some((c) => c.includes("code"))) return "software_build";
  if (capabilities.some((c) => c.includes("strategy"))) return "decision";
  return "investigation";
}

function buildDeliverable(analysis: AnalyzeResult): DeliverableContract {
  const contract = {
    deliverable_type: analysis.capability_families.includes("code")
      ? "software_change"
      : "document",
    audience: "mission_owner",
    purpose: "Deliver mission objective with verifiable evidence",
    required_sections: ["Objective", "Approach", "Output", "Verification", "Risks"],
    required_artifacts: ["audit_trail", "verification_evidence"],
    quality_standard: "Clear, actionable, and evidence-backed",
    acceptance_criteria: analysis.success_criteria,
    evidence_requirement: "Claims must include evidence status and references",
    format: analysis.capability_families.includes("design") ? "mixed" : "markdown",
    completion_definition:
      "All acceptance criteria satisfied with evidence; unresolved blockers are absent or explicitly escalated",
  } satisfies DeliverableContract;
  return DeliverableContractSchema.parse(contract);
}

export function buildMissionContextPack(input: {
  missionId: string;
  actor: string;
  context: ContextObject[];
}): MissionContextPack {
  const selected = input.context
    .map((ctx) => ContextObjectSchema.parse(ctx))
    .filter((ctx) => ctx.status !== "UNKNOWN")
    .sort((a, b) => b.confidence - a.confidence)
    .slice(0, 10);

  return MissionContextPackSchema.parse({
    mission_id: input.missionId,
    generated_at: nowIso(),
    generated_by: input.actor,
    selected_context: selected,
    excluded_context_ids: input.context
      .map((ctx) => ctx.id)
      .filter((id) => !selected.some((row) => row.id === id)),
    rationale: "Load relevant context only; avoid full-knowledge-base expansion",
  });
}

export function buildMissionStrategy(input: {
  missionId: string;
  analysis: AnalyzeResult;
  contextPack: MissionContextPack;
}): MissionStrategy {
  const playbook = inferPlaybook(input.analysis.capability_families);
  const deliverable = buildDeliverable(input.analysis);
  const missingInfo = input.analysis.missing_blockers.map((item) => ({
    kind: item.blocking
      ? ("BLOCKER" as const)
      : item.code.includes("CLARIFY")
        ? ("DISCOVERABLE" as const)
        : ("SAFE_ASSUMPTION" as const),
    detail: item.question,
    owner_question_required: item.blocking,
  }));

  return MissionStrategySchema.parse({
    strategy_id: `STRAT-${input.missionId}`,
    mission_id: input.missionId,
    objective: input.analysis.mission_summary,
    desired_outcome: input.analysis.desired_outcome,
    final_deliverable: deliverable,
    selected_playbook: playbook,
    strategy_reasoning: [
      "Owner intent captured from intake request",
      "Relevant context pack selected by confidence and freshness",
      "Strategy selected from capability-family to playbook mapping",
      "Backward planning prepared from deliverable acceptance criteria",
    ],
    missing_information: missingInfo,
    backward_plan_summary: deliverable.acceptance_criteria.map(
      (criterion, index) => `Step ${index + 1}: satisfy "${criterion}" with evidence`,
    ),
    decomposition_ready: missingInfo.every((item) => item.kind !== "BLOCKER"),
  });
}
