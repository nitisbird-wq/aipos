import { z } from "zod";

/**
 * Phase 3a — Planning aggregate schema (ADR-005, PHASE_3_ARCHITECTURE.md §3.2/§7).
 * Schema-only: no repository, service, or API wiring in this change
 * (docs/PHASE_3_DELIVERY_PLAN.md 3a.1). Runtime persistence lands in 3a.2/3a.3.
 */
export const PlanStatusSchema = z.enum([
  "draft",
  "awaiting_approval",
  "approved",
  "rejected",
  "superseded",
  "cancelled",
]);
export type PlanStatus = z.infer<typeof PlanStatusSchema>;

export const PlanSchema = z.object({
  plan_id: z.string().regex(/^PLN-/),
  mission_id: z.string().regex(/^MIS-/),
  plan_version: z.number().int().min(1),
  status: PlanStatusSchema,
  body: z.record(z.string(), z.unknown()),
  created_by: z.string().min(1),
  approved_by: z.string().nullable(),
  rejected_reason: z.string().nullable().optional(),
  correlation_id: z.string().min(1).optional(),
  created_at: z.string(),
  updated_at: z.string(),
});
export type Plan = z.infer<typeof PlanSchema>;

/** Command-only transitions (ADR-005 D-005.4). No direct PATCH of `status`. */
export const PlanCommandSchema = z.object({
  command: z.enum(["plan_create", "plan_submit", "plan_approve", "plan_reject", "plan_cancel"]),
  reason: z.string().min(1).optional(),
  correlation_id: z.string().min(1).optional(),
  causation_id: z.string().min(1).optional(),
});
export type PlanCommand = z.infer<typeof PlanCommandSchema>;
