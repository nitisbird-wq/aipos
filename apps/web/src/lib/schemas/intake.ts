import { z } from "zod";

export const OperationalRiskSchema = z.enum(["L0", "L1", "L2", "L3", "L4"]);
export type OperationalRisk = z.infer<typeof OperationalRiskSchema>;

export const SensitivityFlagSchema = z.enum([
  "personal_data",
  "police_case_data",
  "legal_privileged",
  "financial",
  "credentials",
  "health",
  "minors",
  "internal_confidential",
  "public_reputation",
  "production_system",
]);
export type SensitivityFlag = z.infer<typeof SensitivityFlagSchema>;

export const ReadinessStatusSchema = z.enum([
  "needs_input",
  "awaiting_confirmation",
  "ready_to_dispatch",
  "cancelled",
]);
export type ReadinessStatus = z.infer<typeof ReadinessStatusSchema>;

export const AssumptionSchema = z.object({
  id: z.string(),
  text: z.string(),
  critical: z.boolean(),
  source: z.enum(["inferred", "user_stated", "knowledge"]),
});

export const MissingBlockerSchema = z.object({
  code: z.string(),
  question: z.string(),
  blocking: z.boolean(),
  answer: z.string().optional(),
  resolved: z.boolean(),
});

export const DraftWorkstreamSchema = z.object({
  id: z.string().regex(/^WS/),
  name: z.string(),
  purpose: z.string(),
  expected_outputs: z.array(z.string()),
  capability_families: z.array(z.string()),
  depends_on_ws: z.array(z.string()),
  approval_points: z.array(z.string()),
  notes: z.string().optional(),
});

export const DataDestinationSchema = z
  .object({
    system: z
      .string()
      .min(1)
      .refine((v) => v !== "none", {
        message: "system must not be 'none'",
      }),
    trust_class: z.string(),
    purpose: z.string(),
    persistence: z.string(),
    external_transfer: z.boolean(),
    data_classification: z.enum(["public", "internal", "confidential", "restricted"]).optional(),
    retention_days: z.number().int().min(0).optional(),
    redaction_required: z.boolean().optional(),
    redaction_policy: z.string().optional(),
    owner: z.string().optional(),
    lawful_purpose: z.string().optional(),
    encryption_requirement: z.string().optional(),
    allowed_processors: z.array(z.string()).optional(),
  })
  .strict();

export const IntakeMissionBundleSchema = z.object({
  intake_id: z.string().regex(/^INT-/),
  intake_version: z.literal("1.0"),
  requester_id: z.string().min(1),
  source: z.enum(["web_app", "chatgpt"]),
  source_message_ref: z.string(),
  raw_request: z.string().min(1),
  mission_summary: z.string(),
  desired_outcome: z.string(),
  success_criteria: z.array(z.string()),
  constraints: z.array(z.string()),
  assumptions: z.array(AssumptionSchema),
  missing_blockers: z.array(MissingBlockerSchema),
  draft_workstreams: z.array(DraftWorkstreamSchema),
  capability_families: z.array(z.string()),
  operational_risk: OperationalRiskSchema,
  sensitivity_flags: z.array(SensitivityFlagSchema),
  sensitivity_acknowledged: z.boolean(),
  approval_requirements: z.array(z.record(z.string(), z.unknown())),
  knowledge_refs: z.array(z.record(z.string(), z.unknown())),
  attachments: z.array(z.record(z.string(), z.unknown())),
  data_destinations: z.array(DataDestinationSchema).min(1),
  data_handling_requirements: z.array(z.string()),
  deadline: z.string().datetime().nullable(),
  readiness_status: ReadinessStatusSchema,
  confirmed_by_user: z.boolean(),
  idempotency_key: z.string().min(1),
  created_at: z.string(),
  updated_at: z.string(),
});

export type IntakeMissionBundle = z.infer<typeof IntakeMissionBundleSchema>;

export const CreateIntakeRequestSchema = z.object({
  raw_request: z.string().min(1).max(20000),
  deadline: z.string().datetime().nullable().optional(),
  constraints: z.array(z.string()).optional(),
  attachments: z.array(z.record(z.string(), z.unknown())).optional(),
  idempotency_key: z.string().min(1).optional(),
});

export type CreateIntakeRequest = z.infer<typeof CreateIntakeRequestSchema>;

export const CorrectIntakeRequestSchema = z.object({
  mission_summary: z.string().optional(),
  desired_outcome: z.string().optional(),
  success_criteria: z.array(z.string()).optional(),
  constraints: z.array(z.string()).optional(),
  assumptions: z.array(AssumptionSchema).optional(),
  missing_blockers: z.array(MissingBlockerSchema).optional(),
  draft_workstreams: z.array(DraftWorkstreamSchema).optional(),
  capability_families: z.array(z.string()).optional(),
  operational_risk: OperationalRiskSchema.optional(),
  sensitivity_flags: z.array(SensitivityFlagSchema).optional(),
  sensitivity_acknowledged: z.boolean().optional(),
  data_handling_requirements: z.array(z.string()).optional(),
  deadline: z.string().datetime().nullable().optional(),
});

export type CorrectIntakeRequest = z.infer<typeof CorrectIntakeRequestSchema>;

export const ConfirmIntakeRequestSchema = z.object({
  sensitivity_acknowledged: z.boolean().optional(),
  reason: z.string().min(1).default("User confirmed intake understanding"),
});

export type ConfirmIntakeRequest = z.infer<typeof ConfirmIntakeRequestSchema>;
