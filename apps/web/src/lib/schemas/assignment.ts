import { z } from "zod";

/**
 * Phase 3a — Assignment aggregate schema (ADR-005, PHASE_3_ARCHITECTURE.md §3.4/§7).
 * Phase 3a ends at `assignment.status=approved` (D-005.1) — no dispatch, no n8n,
 * no execution_job. Schema-only: no repository, service, or API wiring in this
 * change (3a.1); propose/approve commands land in 3a.6.
 */
export const AssignmentStatusSchema = z.enum([
  "proposed",
  "awaiting_approval",
  "approved",
  "rejected",
  "revoked",
]);
export type AssignmentStatus = z.infer<typeof AssignmentStatusSchema>;

export const AssignmentSchema = z.object({
  assignment_id: z.string().regex(/^ASG-/),
  mission_id: z.string().regex(/^MIS-/),
  subtask_id: z.string().regex(/^SUB-/),
  status: AssignmentStatusSchema,
  proposed_specialist: z.string().min(1),
  approved_by: z.string().nullable(),
  rejected_reason: z.string().nullable().optional(),
  correlation_id: z.string().min(1).optional(),
  created_at: z.string(),
  updated_at: z.string(),
});
export type Assignment = z.infer<typeof AssignmentSchema>;

/** Command-only transitions (ADR-005 D-005.4). No direct PATCH of `status`. */
export const AssignmentCommandSchema = z.object({
  command: z.enum([
    "assignment_propose",
    "assignment_submit",
    "assignment_approve",
    "assignment_reject",
    "assignment_revoke",
  ]),
  reason: z.string().min(1).optional(),
  correlation_id: z.string().min(1).optional(),
  causation_id: z.string().min(1).optional(),
});
export type AssignmentCommand = z.infer<typeof AssignmentCommandSchema>;
