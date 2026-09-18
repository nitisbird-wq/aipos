import { nowIso } from "@/lib/ids";
import type { OutcomeWorkstream, MissionStrategy } from "@/lib/schemas/contracts";
import {
  AiWorkOrderSchema,
  TaskTypeSchema,
  type AiWorkOrder,
  type InputBinding,
  type SideEffectClass,
  type TaskType,
} from "@/lib/schemas/work-order";

// ── Context for work order generation ─────────────────────────────────────────

export type WorkOrderContext = {
  allWorkstreams: OutcomeWorkstream[];
  previousWorkOrders?: AiWorkOrder[];
};

// ── TaskType inference ─────────────────────────────────────────────────────────

function inferTaskType(ws: OutcomeWorkstream): TaskType {
  const t = ws.title.toLowerCase();
  const o = ws.objective.toLowerCase();
  const caps = ws.required_capabilities.map((c) => c.toLowerCase());
  const tools = ws.proposed_tools.map((t) => t.toLowerCase());

  if (ws.human_gate_required && ws.approval_required) return "HUMAN_GATE";
  // "transcription" / "transcribe" but NOT just "transcript" (which appears as input reference)
  if (
    t.includes("transcription") ||
    t.includes("transcribe") ||
    t.includes("audio transcri") ||
    (t.includes("transcri") && !t.includes("transcript "))
  ) {
    return "TRANSCRIPTION";
  }
  // VERIFICATION before DELIVERY — "Delivery Verification" → VERIFICATION
  if (
    t.includes("verif") ||
    t.includes("check") ||
    o.includes("verif") ||
    o.includes("confirm independent")
  ) {
    return "VERIFICATION";
  }
  if (
    t.includes("deliver") ||
    t.includes("send") ||
    t.includes("publish to") ||
    tools.some((tk) => tk.includes("line_") || tk.includes("notion_writer") || tk.includes("email"))
  ) {
    return "DELIVERY";
  }
  if (
    caps.some((c) => c.includes("design") || c.includes("graphic") || c.includes("image")) ||
    t.includes("graphic") ||
    t.includes("image") ||
    t.includes("visual asset") ||
    tools.some((tk) => tk.includes("image_gen"))
  ) {
    return "IMAGE_GENERATION";
  }
  if (
    t.includes("slide") ||
    t.includes("deck") ||
    o.includes("slide deck") ||
    (t.includes("presentation") && (t.includes("assembl") || t.includes("build") || t.includes("creat") || t.includes("produc")))
  ) {
    return "PRESENTATION";
  }
  // Explicit WRITING in title takes priority over analysis/research in objective
  if (
    t.includes("writing") ||
    t.includes("draft") ||
    t.includes("planning") ||
    t.includes("documentation") ||
    (t.includes("write") && !t.includes("overwrite"))
  ) {
    return "WRITING";
  }
  if (
    caps.some((c) => c.includes("code") || c.includes("software") || c.includes("debug")) ||
    t.includes("implement") ||
    t.includes("build") ||
    t.includes("debug") ||
    t.includes("fix")
  ) {
    return "CODING";
  }
  // RESEARCH before ANALYSIS — "research and analysis" → RESEARCH
  if (
    t.includes("research") ||
    t.includes("gather") ||
    t.includes("source") ||
    o.includes("research") ||
    o.includes("gather")
  ) {
    return "RESEARCH";
  }
  if (
    t.includes("analys") ||
    t.includes("compare") ||
    t.includes("evaluat") ||
    t.includes("rank") ||
    t.includes("matrix") ||
    o.includes("analys") ||
    o.includes("compare")
  ) {
    return "ANALYSIS";
  }
  if (
    t.includes("plan") ||
    t.includes("document") ||
    t.includes("report") ||
    t.includes("summary")
  ) {
    return "WRITING";
  }
  return "WRITING";
}

// ── SideEffectClass inference ──────────────────────────────────────────────────

function inferSideEffectClass(ws: OutcomeWorkstream, taskType: TaskType): SideEffectClass {
  const tools = ws.proposed_tools.map((t) => t.toLowerCase());
  const t = ws.title.toLowerCase();

  if (tools.some((tk) => tk.includes("line_"))) return "EXTERNAL_SEND";
  if (tools.some((tk) => tk.includes("email"))) return "EXTERNAL_SEND";
  if (tools.some((tk) => tk.includes("notion_writer"))) return "EXTERNAL_WRITE";
  if (tools.some((tk) => tk.includes("notion_publish"))) return "EXTERNAL_PUBLISH";
  if (taskType === "HUMAN_GATE") return "APPROVAL_SIGNATURE";
  if (taskType === "DELIVERY") {
    if (t.includes("publish")) return "EXTERNAL_PUBLISH";
    if (t.includes("send")) return "EXTERNAL_SEND";
    return "EXTERNAL_WRITE";
  }
  if (taskType === "VERIFICATION") return "READ_ONLY";
  if (tools.some((tk) => tk.includes("web_search") || tk.includes("image_gen"))) {
    return "EXTERNAL_API_READ";
  }
  if (
    taskType === "TRANSCRIPTION" ||
    taskType === "RESEARCH" ||
    taskType === "ANALYSIS" ||
    taskType === "WRITING" ||
    taskType === "PRESENTATION" ||
    taskType === "IMAGE_GENERATION"
  ) {
    return "INTERNAL_DRAFT";
  }
  return "INTERNAL_DRAFT";
}

// ── Input binding builder ──────────────────────────────────────────────────────

function buildInputBindings(
  ws: OutcomeWorkstream,
  allWorkstreams: OutcomeWorkstream[],
  previousWorkOrders: AiWorkOrder[],
): InputBinding[] {
  const bindings: InputBinding[] = [];
  const deps = allWorkstreams.filter((w) => ws.dependencies.includes(w.workstream_id));

  for (const dep of deps) {
    const depWo = previousWorkOrders.find((wo) => wo.workstream_id === dep.workstream_id);
    const artifactKey = dep.expected_output[0] ?? `artifact_from_${dep.workstream_id}`;
    bindings.push({
      binding_key: artifactKey
        .toLowerCase()
        .replace(/[^a-z0-9_]/g, "_")
        .slice(0, 40),
      source_work_order_id: depWo?.work_order_id ?? null,
      artifact_key: artifactKey,
      artifact_version: depWo?.artifact_version ?? null,
      required: true,
      description: `Output from ${dep.title} (${wsLabel(dep, allWorkstreams)})`,
    });
  }

  for (const input of ws.inputs) {
    const alreadyBound = bindings.some((b) => b.description.includes(input));
    if (!alreadyBound) {
      bindings.push({
        binding_key: input
          .toLowerCase()
          .replace(/[^a-z0-9_]/g, "_")
          .slice(0, 40),
        source_work_order_id: null,
        artifact_key: input,
        artifact_version: null,
        required: true,
        description: input,
      });
    }
  }

  return bindings;
}

function wsLabel(ws: OutcomeWorkstream, all: OutcomeWorkstream[]): string {
  const sorted = [...all].sort((a, b) => a.execution_order - b.execution_order);
  const idx = sorted.findIndex((w) => w.workstream_id === ws.workstream_id);
  return `WS${idx + 1}`;
}

// ── Dynamic prompt builders per TaskType ──────────────────────────────────────

function buildMissionBlock(strategy: MissionStrategy): string {
  return [
    `MISSION ID: ${strategy.mission_id}`,
    `MISSION: ${strategy.objective}`,
    `DESIRED OUTCOME: ${strategy.desired_outcome}`,
    `FINAL DELIVERABLE: ${strategy.final_deliverable.deliverable_type} — ${strategy.final_deliverable.purpose}`,
    `AUDIENCE: ${strategy.final_deliverable.audience}`,
  ].join("\n");
}

function inputBlock(bindings: InputBinding[]): string {
  if (!bindings.length) return "";
  const lines = bindings.map(
    (b) =>
      `[INPUT: ${b.artifact_key}]\n{{${b.binding_key}}}  ← ${b.description}\n[END ${b.artifact_key}]`,
  );
  return "\n\n" + lines.join("\n\n");
}

function criteriaBlock(criteria: string[]): string {
  if (!criteria.length) return "";
  return "\n\nACCEPTANCE CRITERIA:\n" + criteria.map((c) => `• ${c}`).join("\n");
}

function evidenceBlock(evidence: string[]): string {
  if (!evidence.length) return "";
  return "\n\nEVIDENCE REQUIRED:\n" + evidence.map((e) => `• ${e}`).join("\n");
}

function buildTranscriptionPrompt(
  ws: OutcomeWorkstream,
  missionBlock: string,
  inputs: InputBinding[],
): string {
  return `ROLE: You are a professional transcription specialist.

${missionBlock}

TASK: ${ws.objective}

${inputBlock(inputs)}

INSTRUCTIONS:
1. Produce a verbatim transcript from the provided audio/video input.
2. Include timestamps every 2–5 minutes in format [HH:MM:SS].
3. Identify and label different speakers when distinguishable (Speaker 1, Speaker 2, etc.).
4. Preserve all technical terms and proper nouns exactly as spoken.
5. Note any inaudible sections as [INAUDIBLE].
6. Produce a brief summary (3–5 sentences) at the end.
${criteriaBlock(ws.acceptance_criteria)}
${evidenceBlock(ws.evidence_requirements)}

OUTPUT FORMAT:
Return a structured document with: (1) Summary paragraph, (2) Full timestamped transcript, (3) Key terms list.`;
}

function buildResearchPrompt(
  ws: OutcomeWorkstream,
  missionBlock: string,
  inputs: InputBinding[],
  strategy: MissionStrategy,
): string {
  return `ROLE: You are a research specialist conducting structured evidence gathering.

${missionBlock}

TASK: ${ws.objective}

RESEARCH SCOPE: ${ws.reason_required}
${inputBlock(inputs)}

INSTRUCTIONS:
1. Search for information relevant to the task using available tools.
2. Evaluate each source for credibility, recency, and relevance.
3. Gather a minimum of 3–5 distinct, high-quality sources.
4. Extract key findings, data points, and evidence.
5. Identify conflicting information and note discrepancies.
6. Do NOT include opinions or assumptions — facts and evidence only.
7. Final deliverable: ${strategy.final_deliverable.deliverable_type} for ${strategy.final_deliverable.audience}.
${criteriaBlock(ws.acceptance_criteria)}
${evidenceBlock(ws.evidence_requirements)}

OUTPUT FORMAT:
Return a structured research brief: (1) Executive summary, (2) Key findings with source citations, (3) Data points and evidence, (4) Gaps and uncertainties, (5) Recommended next steps.`;
}

function buildAnalysisPrompt(
  ws: OutcomeWorkstream,
  missionBlock: string,
  inputs: InputBinding[],
): string {
  return `ROLE: You are an analytical specialist producing structured analysis.

${missionBlock}

TASK: ${ws.objective}

ANALYTICAL FOCUS: ${ws.reason_required}
${inputBlock(inputs)}

INSTRUCTIONS:
1. Apply systematic analysis to the provided inputs.
2. Identify patterns, trends, anomalies, and key insights.
3. Compare and contrast options or scenarios where applicable.
4. Quantify findings using available data.
5. Derive actionable conclusions directly supported by evidence.
6. Flag any assumptions made during analysis.
7. Do NOT exceed the analytical scope defined above.
${criteriaBlock(ws.acceptance_criteria)}
${evidenceBlock(ws.evidence_requirements)}

OUTPUT FORMAT:
Return a structured analysis: (1) Analysis summary, (2) Key findings with supporting data, (3) Comparison matrix/ranking if applicable, (4) Conclusions and recommendations, (5) Confidence level and caveats.`;
}

function buildWritingPrompt(
  ws: OutcomeWorkstream,
  missionBlock: string,
  inputs: InputBinding[],
  strategy: MissionStrategy,
): string {
  return `ROLE: You are a professional writer producing a structured document.

${missionBlock}

TASK: ${ws.objective}

DOCUMENT PURPOSE: ${ws.reason_required}
AUDIENCE: ${strategy.final_deliverable.audience}
FORMAT: ${strategy.final_deliverable.format}
${inputBlock(inputs)}

INSTRUCTIONS:
1. Write from the perspective of the intended audience.
2. Structure the document with clear headings and sections.
3. Use information from provided inputs — do NOT fabricate data.
4. Maintain professional tone appropriate for the audience.
5. Include all required sections: ${strategy.final_deliverable.required_sections.join(", ")}.
6. Length and depth should match the quality standard: ${strategy.final_deliverable.quality_standard}.
${criteriaBlock(ws.acceptance_criteria)}
${evidenceBlock(ws.evidence_requirements)}

OUTPUT FORMAT:
Return the complete document with: (1) Title and metadata, (2) All required sections in order, (3) Conclusion/next steps, (4) Document version and date.`;
}

function buildImageGenerationPrompt(
  ws: OutcomeWorkstream,
  missionBlock: string,
  inputs: InputBinding[],
): string {
  return `ROLE: You are a creative director briefing an image generation specialist.

${missionBlock}

TASK: ${ws.objective}

VISUAL PURPOSE: ${ws.reason_required}
${inputBlock(inputs)}

INSTRUCTIONS:
1. Review the provided content inputs and extract key visual themes.
2. Generate detailed image generation prompts for each required visual asset.
3. Specify: subject, style, mood, color palette, composition, lighting.
4. Ensure visuals align with the final deliverable's audience and purpose.
5. Produce one optimized prompt per required asset.
6. Include negative prompt terms to avoid unwanted elements.
7. Specify dimensions and format for each asset.
${criteriaBlock(ws.acceptance_criteria)}
${evidenceBlock(ws.evidence_requirements)}

OUTPUT FORMAT:
Return a structured visual brief: (1) Overall visual direction, (2) Per-asset generation prompts, (3) Color palette specification, (4) Style guidelines, (5) Asset inventory list with dimensions.`;
}

function buildPresentationPrompt(
  ws: OutcomeWorkstream,
  missionBlock: string,
  inputs: InputBinding[],
  strategy: MissionStrategy,
): string {
  return `ROLE: You are a presentation specialist building a structured slide deck.

${missionBlock}

TASK: ${ws.objective}

PRESENTATION PURPOSE: ${ws.reason_required}
AUDIENCE: ${strategy.final_deliverable.audience}
${inputBlock(inputs)}

INSTRUCTIONS:
1. Structure the presentation with a clear narrative arc.
2. Build an outline with slide titles and key messages per slide.
3. Each slide should have: title, 3–5 bullet points or key visual, speaker notes.
4. Opening: context and problem statement.
5. Body: findings, analysis, recommendations (from provided inputs).
6. Closing: summary, call to action, next steps.
7. Do NOT exceed 20 slides for a standard executive presentation.
8. Use only data from provided inputs — no fabricated statistics.
${criteriaBlock(ws.acceptance_criteria)}
${evidenceBlock(ws.evidence_requirements)}

OUTPUT FORMAT:
Return a structured presentation outline: (1) Deck overview (title, audience, purpose), (2) Slide-by-slide outline with content, (3) Speaker notes per slide, (4) Visual recommendations per slide, (5) Opening and closing scripts.`;
}

function buildVerificationPrompt(
  ws: OutcomeWorkstream,
  missionBlock: string,
  inputs: InputBinding[],
): string {
  return `ROLE: You are an independent verification specialist.

${missionBlock}

TASK: ${ws.objective}

VERIFICATION SCOPE: ${ws.reason_required}
${inputBlock(inputs)}

INSTRUCTIONS:
1. Independently review the provided artifact against the stated acceptance criteria.
2. Check each criterion systematically — pass or fail with evidence.
3. Identify any factual errors, missing content, or quality issues.
4. Do NOT assume items are correct without evidence.
5. Flag any items that require Owner review or decision.
6. Summarize overall pass/fail status with confidence level.
${criteriaBlock(ws.acceptance_criteria)}
${evidenceBlock(ws.evidence_requirements)}

OUTPUT FORMAT:
Return a structured verification report: (1) Overall status (PASS/FAIL/CONDITIONAL), (2) Criterion-by-criterion results, (3) Issues found with severity, (4) Evidence references, (5) Recommended actions.`;
}

function buildDeliveryPrompt(
  ws: OutcomeWorkstream,
  missionBlock: string,
  inputs: InputBinding[],
): string {
  const tools = ws.proposed_tools.join(", ");
  return `ROLE: You are a delivery specialist executing authorized external delivery.

${missionBlock}

TASK: ${ws.objective}

DELIVERY SCOPE: ${ws.reason_required}
AUTHORIZED TOOLS: ${tools}
${inputBlock(inputs)}

CRITICAL GOVERNANCE RULES:
• This delivery is EXTERNAL — policy must be evaluated immediately before execution.
• Use ONLY the authorized tools listed above.
• Do NOT send to destinations not listed in the approved scope.
• Record idempotency key before executing.
• Verify delivery confirmation after execution.

INSTRUCTIONS:
1. Verify that all required inputs are present and complete.
2. Confirm the delivery destination matches the approved scope.
3. Execute delivery using only authorized adapters.
4. Record the idempotency key: IDEMPOTENCY-${ws.workstream_id}-{{timestamp}}.
5. Confirm delivery with receipt/confirmation from the destination system.
6. Record evidence: delivery_id, timestamp, destination, artifact_ref.
${criteriaBlock(ws.acceptance_criteria)}
${evidenceBlock(ws.evidence_requirements)}

OUTPUT FORMAT:
Return a delivery receipt: (1) Delivery status (SUCCESS/FAILED), (2) Destination confirmed, (3) Idempotency key used, (4) Delivery confirmation ID, (5) Evidence artifacts.`;
}

function buildHumanGatePrompt(ws: OutcomeWorkstream, missionBlock: string): string {
  return `ROLE: This is a Human Gate — Owner approval is required before proceeding.

${missionBlock}

GATE PURPOSE: ${ws.objective}

REASON FOR GATE: ${ws.reason_required}

WHAT THE OWNER MUST REVIEW:
${ws.proposed_actions.map((a, i) => `${i + 1}. ${a}`).join("\n")}

WHAT HAPPENS AFTER APPROVAL:
${ws.expected_output.map((o, i) => `${i + 1}. ${o}`).join("\n")}

DECISION REQUIRED:
• Review all artifacts and outputs produced so far.
• Confirm they meet the acceptance criteria.
• Explicitly APPROVE or REJECT before execution can continue.
• If REJECTING: specify what must change and which workstream must be re-done.
${criteriaBlock(ws.acceptance_criteria)}

AUTHORITY: This gate requires ${ws.authority_level} authority — Owner decision only.
AUTO-AUTHORIZE: NOT PERMITTED for this gate.
SYSTEM WILL WAIT until Owner provides explicit approval decision.`;
}

function buildCodingPrompt(
  ws: OutcomeWorkstream,
  missionBlock: string,
  inputs: InputBinding[],
): string {
  return `ROLE: You are a software engineer implementing the specified functionality.

${missionBlock}

TASK: ${ws.objective}

IMPLEMENTATION SCOPE: ${ws.reason_required}
TOOLS/STACK: ${ws.proposed_tools.join(", ")}
${inputBlock(inputs)}

INSTRUCTIONS:
1. Review the provided context and requirements carefully.
2. Implement only what is specified — no gold-plating.
3. Write tests for all new functionality.
4. Follow existing code conventions and patterns.
5. Do NOT modify code outside the specified scope.
6. Commit with descriptive messages referencing this work order.
7. Run tests before declaring completion.
${criteriaBlock(ws.acceptance_criteria)}
${evidenceBlock(ws.evidence_requirements)}

OUTPUT FORMAT:
Return a structured delivery: (1) Summary of changes made, (2) Files modified/created, (3) Tests written and results, (4) Evidence of passing tests, (5) Any blockers or open questions.`;
}

// ── Main dispatcher ────────────────────────────────────────────────────────────

function buildExecutionPrompt(
  taskType: TaskType,
  ws: OutcomeWorkstream,
  strategy: MissionStrategy,
  bindings: InputBinding[],
): string {
  const mb = buildMissionBlock(strategy);

  switch (taskType) {
    case "TRANSCRIPTION":
      return buildTranscriptionPrompt(ws, mb, bindings);
    case "RESEARCH":
      return buildResearchPrompt(ws, mb, bindings, strategy);
    case "ANALYSIS":
      return buildAnalysisPrompt(ws, mb, bindings);
    case "WRITING":
      return buildWritingPrompt(ws, mb, bindings, strategy);
    case "IMAGE_GENERATION":
      return buildImageGenerationPrompt(ws, mb, bindings);
    case "PRESENTATION":
      return buildPresentationPrompt(ws, mb, bindings, strategy);
    case "VERIFICATION":
      return buildVerificationPrompt(ws, mb, bindings);
    case "DELIVERY":
      return buildDeliveryPrompt(ws, mb, bindings);
    case "HUMAN_GATE":
      return buildHumanGatePrompt(ws, mb);
    case "CODING":
      return buildCodingPrompt(ws, mb, bindings);
    default:
      return buildWritingPrompt(ws, mb, bindings, strategy);
  }
}

// ── Output schema derivation ───────────────────────────────────────────────────

function deriveOutputSchema(taskType: TaskType, ws: OutcomeWorkstream) {
  const artifactKey = ws.expected_output[0] ?? `output_${ws.workstream_id}`;
  const formatMap: Record<
    TaskType,
    { artifact_type: string; format: string }
  > = {
    TRANSCRIPTION: { artifact_type: "document", format: "markdown" },
    RESEARCH: { artifact_type: "document", format: "markdown" },
    ANALYSIS: { artifact_type: "structured_data", format: "markdown+json" },
    WRITING: { artifact_type: "document", format: "markdown" },
    IMAGE_GENERATION: { artifact_type: "image", format: "png+prompt_brief" },
    PRESENTATION: { artifact_type: "slide_deck", format: "markdown_outline" },
    CODING: { artifact_type: "text", format: "code+diff" },
    VERIFICATION: { artifact_type: "verification_report", format: "markdown" },
    DELIVERY: { artifact_type: "external_id", format: "json_receipt" },
    HUMAN_GATE: { artifact_type: "document", format: "approval_decision" },
  };
  const fm = formatMap[taskType] ?? { artifact_type: "text", format: "markdown" };
  return {
    artifact_key: artifactKey,
    artifact_type: fm.artifact_type as
      | "text"
      | "document"
      | "image"
      | "slide_deck"
      | "structured_data"
      | "external_id"
      | "verification_report",
    format: fm.format,
    version: "v1",
  };
}

// ── Failure & retry instructions ───────────────────────────────────────────────

function buildFailureInstructions(taskType: TaskType, ws: OutcomeWorkstream): string {
  const base = `If this work order fails: (1) Record the failure with evidence, (2) Do NOT attempt side effects again without re-authorization.`;
  if (taskType === "DELIVERY") {
    return `${base} For delivery failures: verify idempotency key, check destination availability, re-run ONLY after policy re-evaluation. Max 3 retries with exponential backoff.`;
  }
  if (taskType === "HUMAN_GATE") {
    return `Gate cannot fail — it waits indefinitely for Owner decision. If Owner is unavailable, escalate via recovery strategy: ${ws.recovery_strategy || "contact mission owner directly"}.`;
  }
  return `${base} Recovery strategy: ${ws.recovery_strategy || "escalate to mission owner"}. Do NOT skip or bypass this work order.`;
}

// ── Work order ID generator ────────────────────────────────────────────────────

function makeWorkOrderId(missionId: string, workstreamId: string): string {
  return `WO-${missionId}-${workstreamId}`.replace(/--+/g, "-").slice(0, 80);
}

// ── Main public API ────────────────────────────────────────────────────────────

export function generateWorkOrder(
  ws: OutcomeWorkstream,
  strategy: MissionStrategy,
  context: WorkOrderContext,
): AiWorkOrder {
  const taskType = inferTaskType(ws);
  const sideEffectClass = inferSideEffectClass(ws, taskType);
  const allPrevious = context.previousWorkOrders ?? [];
  const bindings = buildInputBindings(ws, context.allWorkstreams, allPrevious);
  const prompt = buildExecutionPrompt(taskType, ws, strategy, bindings);
  const outputSchema = deriveOutputSchema(taskType, ws);

  const depWorkOrders = context.allWorkstreams
    .filter((w) => ws.dependencies.includes(w.workstream_id))
    .map((w) => {
      const wo = allPrevious.find((p) => p.workstream_id === w.workstream_id);
      return wo?.work_order_id ?? makeWorkOrderId(strategy.mission_id, w.workstream_id);
    });

  const humanDecisionRequired = ws.human_gate_required || taskType === "HUMAN_GATE";
  const humanDecisionQuestion =
    humanDecisionRequired
      ? ws.proposed_actions[0] ?? `Approve ${ws.title} before proceeding?`
      : null;

  const approvalScope =
    sideEffectClass !== "READ_ONLY" && sideEffectClass !== "INTERNAL_DRAFT"
      ? {
          requires_scope_binding: true,
          bound_approval_id: null,
          scope_description: `${ws.title}: authorized to use [${ws.proposed_tools.join(", ")}] for mission ${strategy.mission_id}`,
        }
      : null;

  const now = nowIso();

  const wo = AiWorkOrderSchema.parse({
    work_order_id: makeWorkOrderId(strategy.mission_id, ws.workstream_id),
    mission_id: strategy.mission_id,
    workstream_id: ws.workstream_id,
    task_type: taskType,
    prompt_version: "1.0.0",
    status: "PENDING_REVIEW",

    task_objective: ws.objective,
    mission_context: `[${strategy.mission_id}] ${strategy.objective} → ${strategy.desired_outcome}`,

    required_inputs: ws.inputs,
    input_bindings: bindings,
    previous_artifacts: ws.dependencies
      .map((depId) => {
        const dep = context.allWorkstreams.find((w) => w.workstream_id === depId);
        return dep?.expected_output[0] ?? depId;
      })
      .filter(Boolean),

    proposed_actions: ws.proposed_actions.length ? ws.proposed_actions : ws.execution_steps,
    recommended_worker: ws.proposed_worker || "ai_assistant",
    recommended_tools: ws.proposed_tools,

    execution_prompt: prompt,

    expected_output: ws.expected_output[0] ?? ws.objective,
    output_schema: outputSchema,
    artifact_version: "v1",

    evidence_requirements: ws.evidence_requirements,
    acceptance_criteria: ws.acceptance_criteria,

    depends_on_work_orders: depWorkOrders,

    authority_level: ws.authority_level,
    risk_level: ws.risk_level,
    side_effect_class: sideEffectClass,
    human_decision_required: humanDecisionRequired,
    human_decision_question: humanDecisionQuestion,
    approval_scope: approvalScope,

    failure_instructions: buildFailureInstructions(taskType, ws),
    retry_policy:
      sideEffectClass === "READ_ONLY" || sideEffectClass === "INTERNAL_DRAFT"
        ? "Retry up to 3 times; no approval needed"
        : "STOP on first failure. Re-run only after Owner re-authorization.",

    handoff_instructions: `After completion: record artifact as [${outputSchema.artifact_key}@v1] in mission ${strategy.mission_id}. Downstream tasks requiring this artifact: ${ws.expected_output.join(", ")}.`,

    created_at: now,
    updated_at: now,
  });

  return wo;
}

export function generateAllWorkOrders(
  plan: { workstreams: OutcomeWorkstream[] },
  strategy: MissionStrategy,
): AiWorkOrder[] {
  const sorted = [...plan.workstreams].sort((a, b) => a.execution_order - b.execution_order);
  const results: AiWorkOrder[] = [];

  for (const ws of sorted) {
    const wo = generateWorkOrder(ws, strategy, {
      allWorkstreams: sorted,
      previousWorkOrders: results,
    });
    results.push(wo);
  }

  return results;
}

// Re-export TaskType for consumers
export { TaskTypeSchema };
