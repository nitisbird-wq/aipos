import { z } from "zod";

export const PolicySchema = z.object({
  policy_id: z.string(),
  version: z.string(),
  name: z.string(),
  rule_key: z.string(),
  description: z.string(),
  severity: z.enum(["low", "medium", "high", "critical"]),
  enabled: z.boolean(),
  action_on_violation: z.enum(["block", "warn", "require_approval", "audit_only"]),
  effective_from: z.string(),
  change_reason: z.string(),
  change_log: z.array(z.unknown()),
});

export type Policy = z.infer<typeof PolicySchema>;

export const CapabilitySchema = z.object({
  capability_id: z.string(),
  family: z.string(),
  name: z.string(),
  enabled: z.boolean(),
  specialists: z.array(z.unknown()).optional(),
  alternatives: z.array(z.string()).optional(),
  installable: z.boolean().optional(),
  installation_hint: z.string().optional(),
  allows_manual: z.boolean().optional(),
  auto_route_enabled: z.boolean().optional(),
  status: z.string().optional(),
  human_review_required: z.boolean().optional(),
});

export type Capability = z.infer<typeof CapabilitySchema>;

export const PolicyDecisionSchema = z.enum(["allow", "block", "warn", "require_approval"]);

export const AuditEventSchema = z.object({
  id: z.string(),
  aggregate_type: z
    .enum(["intake", "mission", "notion_sync", "policy", "system"])
    .nullable()
    .optional(),
  mission_id: z.string().nullable(),
  intake_id: z.string().nullable(),
  actor: z.string(),
  action: z.string(),
  reason: z.string(),
  correlation_id: z.string(),
  causation_id: z.string().nullable().optional(),
  previous_state: z.string().nullable(),
  new_state: z.string().nullable(),
  policy_result: z
    .object({
      decision: PolicyDecisionSchema.optional(),
    })
    .passthrough(),
  created_at: z.string(),
});

export type AuditEvent = z.infer<typeof AuditEventSchema>;

export const MappingRejectCodeSchema = z.enum([
  "INTAKE_NOT_CONFIRMED",
  "MISSING_SUCCESS_CRITERIA",
  "UNRESOLVED_BLOCKER",
  "DATA_DESTINATION_NOT_APPROVED",
  "HANDLING_GATE_FAILED",
  "DUPLICATE_INTAKE",
  "READINESS_NOT_READY",
  "MISSING_DESIRED_OUTCOME",
  "MISSING_OPERATIONAL_RISK",
  "ACTOR_NOT_AUTHORIZED",
]);

export type MappingRejectCode = z.infer<typeof MappingRejectCodeSchema>;
