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
import type { Playbook } from "@/lib/services/playbook-engine";

function inferPlaybook(analysis: AnalyzeResult): Playbook["id"] {
  const caps = analysis.capability_families.join(" ");
  const rawText = `${analysis.mission_summary} ${analysis.desired_outcome}`;
  const text = rawText.toLowerCase();

  // 1. Explicit bug/incident signals → debug (highest specificity)
  if (/\b(bug|debug|reproduc|incident|fail(ing|ure)?|error)\b/.test(text)) return "debug";

  // 2. Workflow automation
  if (/\b(automat(e|ion)|n8n|workflow|recurring)\b/.test(text) || caps.includes("automation")) {
    return "automation";
  }

  // 3. Explicit decision framing (brief, executive decision) — check BEFORE research to avoid
  //    "executive decision brief recommend option" being absorbed by research patterns
  if (
    /\b(decision\s+brief|executive\s+brief|decide\s+between|choose\s+between)\b/.test(text) ||
    (/\b(decision|brief|executive)\b/.test(text) && !/\b(research|evidence|compare)\b/.test(text))
  ) {
    return "decision";
  }

  // 4. Research + Recommendation — evidence-gathering, comparison, pros/cons signals
  if (
    /\b(competitor|research|literature|survey|evidence|compare|evaluate|pros|cons|rank)\b/.test(
      text,
    ) ||
    /(หลักฐาน|เปรียบเทียบ|ข้อดีข้อเสีย|ประเมิน|คัดเลือก|จัดอันดับ|หาข้อมูล|สืบค้น)/.test(rawText) ||
    caps.includes("research")
  ) {
    return "research";
  }

  // 5. Knowledge base management (organizing an existing KB, not learning)
  if (
    /\b(notion|knowledge base|kb|taxonomy|organiz(e|ation))\b/.test(text) ||
    /(จัดการความรู้|ฐานความรู้|จัดระเบียบ)/.test(rawText) ||
    caps.includes("knowledge_management")
  ) {
    return "knowledge_organization";
  }

  // 6. Business launch
  if (/\b(launch|go-to-market|pricing|offer)\b/.test(text) || caps.includes("domain.business")) {
    return "business_launch";
  }

  // 7. Decision (broader catch — recommend without evidence = decision brief)
  if (/\b(decision|brief|recommend)\b/.test(text) || caps.includes("strategy_analysis")) {
    return "decision";
  }

  // 8. Creative
  if (/\b(design|prototype|creative|visual)\b/.test(text) || caps.includes("design")) {
    return "creative_synthesis";
  }

  // 9. Software build (only when code family is explicit and no research signals)
  if (caps.includes("code") || /\b(implement|feature|build|software)\b/.test(text)) {
    return "software_build";
  }

  return "investigation";
}

function deliverableTypeFor(playbook: Playbook["id"], analysis: AnalyzeResult): string {
  switch (playbook) {
    case "software_build":
    case "debug":
      return "software_change";
    case "automation":
      return "workflow_definition";
    case "decision":
      return "decision_brief";
    case "business_launch":
      return "launch_plan";
    case "knowledge_organization":
      return "knowledge_structure";
    case "creative_synthesis":
      return analysis.capability_families.includes("design") ? "creative_package" : "document";
    case "research":
      return "research_report";
    default:
      return "investigation_report";
  }
}

function buildDeliverable(analysis: AnalyzeResult, playbook: Playbook["id"]): DeliverableContract {
  const deliverable_type = deliverableTypeFor(playbook, analysis);
  const contract = {
    deliverable_type,
    audience: "mission_owner",
    purpose: `Deliver ${deliverable_type} for: ${analysis.desired_outcome}`,
    required_sections: ["Objective", "Approach", "Output", "Verification", "Risks"],
    required_artifacts: ["audit_trail", "verification_evidence"],
    quality_standard: "Clear, actionable, domain-specific, and evidence-backed",
    acceptance_criteria: analysis.success_criteria,
    evidence_requirement: "Claims must include evidence status and references; no silent promotion",
    format: analysis.capability_families.includes("design") ? "mixed" : "markdown",
    completion_definition:
      "All acceptance criteria satisfied with evidence; unresolved blockers are absent or explicitly escalated",
  } satisfies DeliverableContract;
  return DeliverableContractSchema.parse(contract);
}

function classifyMissing(analysis: AnalyzeResult): MissionStrategy["missing_information"] {
  return analysis.missing_blockers.map((item) => {
    if (item.blocking) {
      return {
        kind: "BLOCKER" as const,
        detail: item.question,
        owner_question_required: true,
      };
    }
    if (item.resolved && item.code.includes("CLARIFY")) {
      return {
        kind: "SAFE_ASSUMPTION" as const,
        detail: item.question,
        owner_question_required: false,
      };
    }
    if (item.code.includes("CLARIFY") || item.code.includes("FORMAT")) {
      return {
        kind: "DISCOVERABLE" as const,
        detail: item.question,
        owner_question_required: false,
      };
    }
    return {
      kind: "OPTIONAL_REFINEMENT" as const,
      detail: item.question,
      owner_question_required: false,
    };
  });
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
  const playbook = inferPlaybook(input.analysis);
  const deliverable = buildDeliverable(input.analysis, playbook);
  const missingInfo = classifyMissing(input.analysis);

  return MissionStrategySchema.parse({
    strategy_id: `STRAT-${input.missionId}`,
    mission_id: input.missionId,
    objective: input.analysis.mission_summary,
    desired_outcome: input.analysis.desired_outcome,
    final_deliverable: deliverable,
    selected_playbook: playbook,
    strategy_reasoning: [
      "Owner intent captured from intake request",
      `Playbook selected: ${playbook}`,
      `Context pack size: ${input.contextPack.selected_context.length} (excluded ${input.contextPack.excluded_context_ids.length})`,
      "Backward planning prepared from deliverable acceptance criteria",
      "Only BLOCKER missing-info interrupts owner",
    ],
    missing_information: missingInfo,
    backward_plan_summary: deliverable.acceptance_criteria.map(
      (criterion, index) => `Step ${index + 1}: satisfy "${criterion}" with evidence`,
    ),
    decomposition_ready: missingInfo.every((item) => item.kind !== "BLOCKER"),
  });
}
