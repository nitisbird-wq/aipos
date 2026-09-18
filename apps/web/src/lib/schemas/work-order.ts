import { z } from "zod";

// ── Enums ──────────────────────────────────────────────────────────────────────

export const TaskTypeSchema = z.enum([
  "TRANSCRIPTION",
  "RESEARCH",
  "ANALYSIS",
  "WRITING",
  "IMAGE_GENERATION",
  "PRESENTATION",
  "CODING",
  "VERIFICATION",
  "DELIVERY",
  "HUMAN_GATE",
]);
export type TaskType = z.infer<typeof TaskTypeSchema>;

export const WorkOrderStatusSchema = z.enum([
  "PENDING_REVIEW",
  "APPROVED",
  "EDITED",
  "REGENERATED",
  "EXECUTING",
  "DONE",
]);
export type WorkOrderStatus = z.infer<typeof WorkOrderStatusSchema>;

export const SideEffectClassSchema = z.enum([
  "READ_ONLY",
  "INTERNAL_DRAFT",
  "EXTERNAL_API_READ",
  "EXTERNAL_WRITE",
  "EXTERNAL_SEND",
  "EXTERNAL_PUBLISH",
  "EXTERNAL_DELETE",
  "FINANCIAL",
  "APPROVAL_SIGNATURE",
]);
export type SideEffectClass = z.infer<typeof SideEffectClassSchema>;

// ── Sub-schemas ────────────────────────────────────────────────────────────────

export const InputBindingSchema = z.object({
  binding_key: z.string().min(1),
  source_work_order_id: z.string().nullable(),
  artifact_key: z.string().min(1),
  artifact_version: z.string().nullable(),
  required: z.boolean(),
  description: z.string().min(1),
});
export type InputBinding = z.infer<typeof InputBindingSchema>;

export const OutputSchemaSchema = z.object({
  artifact_key: z.string().min(1),
  artifact_type: z.enum([
    "text",
    "document",
    "image",
    "slide_deck",
    "structured_data",
    "external_id",
    "verification_report",
  ]),
  format: z.string().min(1),
  version: z.string().default("v1"),
});
export type OutputSchema = z.infer<typeof OutputSchemaSchema>;

export const ApprovalScopeRecordSchema = z.object({
  requires_scope_binding: z.boolean(),
  bound_approval_id: z.string().nullable(),
  scope_description: z.string().min(1),
});
export type ApprovalScopeRecord = z.infer<typeof ApprovalScopeRecordSchema>;

// ── Main AI_WORK_ORDER schema ──────────────────────────────────────────────────

export const AiWorkOrderSchema = z.object({
  work_order_id: z.string().min(1),          // e.g. WO-MIS-001-WS-01
  mission_id: z.string().min(1),
  workstream_id: z.string().min(1),
  task_type: TaskTypeSchema,
  prompt_version: z.string().min(1),         // semver e.g. "1.0.0"
  status: WorkOrderStatusSchema,

  // Q1: What — objective & context
  task_objective: z.string().min(1),
  mission_context: z.string().min(1),

  // Q2: Inputs
  required_inputs: z.array(z.string()),
  input_bindings: z.array(InputBindingSchema),

  // Q3: Previous artifacts consumed
  previous_artifacts: z.array(z.string()),

  // Q4: How — actions
  proposed_actions: z.array(z.string()),

  // Q5: Worker
  recommended_worker: z.string().min(1),

  // Q6: Tools
  recommended_tools: z.array(z.string()),

  // Q7: Ready-to-use execution prompt (dynamically generated)
  execution_prompt: z.string().min(1),

  // Q8: Output
  expected_output: z.string().min(1),
  output_schema: OutputSchemaSchema,
  artifact_version: z.string().default("v1"),

  // Q9: Evidence
  evidence_requirements: z.array(z.string()),
  acceptance_criteria: z.array(z.string()),

  // Q10: Dependencies
  depends_on_work_orders: z.array(z.string()),

  // Q11: Owner decision / authority
  authority_level: z.enum(["L0", "L1", "L2", "L3", "L4"]),
  risk_level: z.enum(["L0", "L1", "L2", "L3", "L4"]),
  side_effect_class: SideEffectClassSchema,
  human_decision_required: z.boolean(),
  human_decision_question: z.string().nullable(),
  approval_scope: ApprovalScopeRecordSchema.nullable(),

  // Q12: Failure
  failure_instructions: z.string().min(1),
  retry_policy: z.string().min(1),

  // Q13: Next destination / handoff
  handoff_instructions: z.string().min(1),

  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
});
export type AiWorkOrder = z.infer<typeof AiWorkOrderSchema>;
