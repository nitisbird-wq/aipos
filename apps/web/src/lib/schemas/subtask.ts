import { z } from "zod";

/**
 * Phase 3a — Subtask aggregate schema (ADR-005, PHASE_3_ARCHITECTURE.md §3.3/§7).
 * L0–L1 risk only in 3a (PHASE_3_ACCEPTANCE_CRITERIA.md P3-C2). Schema-only:
 * no repository, service, or API wiring in this change (3a.1); generation from
 * an approved plan lands in 3a.5.
 */
export const SubtaskStatusSchema = z.enum([
  "proposed",
  "approved",
  "ready",
  "blocked",
  "cancelled",
]);
export type SubtaskStatus = z.infer<typeof SubtaskStatusSchema>;

/** 3a only generates L0–L1 risk subtasks (P3-C2); L2+ is out of scope. */
export const SubtaskRiskSchema = z.enum(["L0", "L1"]);
export type SubtaskRisk = z.infer<typeof SubtaskRiskSchema>;

export const SubtaskSchema = z.object({
  subtask_id: z.string().regex(/^SUB-/),
  plan_id: z.string().regex(/^PLN-/),
  mission_id: z.string().regex(/^MIS-/),
  status: SubtaskStatusSchema,
  risk: SubtaskRiskSchema,
  depends_on: z.array(z.string().regex(/^SUB-/)),
  body: z.record(z.string(), z.unknown()),
  correlation_id: z.string().min(1).optional(),
  created_at: z.string(),
  updated_at: z.string(),
});
export type Subtask = z.infer<typeof SubtaskSchema>;

/** Command-only transitions (ADR-005 D-005.4). No direct PATCH of `status`. */
export const SubtaskCommandSchema = z.object({
  command: z.enum([
    "subtask_generate",
    "subtask_approve_set",
    "subtask_mark_ready",
    "subtask_cancel",
  ]),
  reason: z.string().min(1).optional(),
  correlation_id: z.string().min(1).optional(),
  causation_id: z.string().min(1).optional(),
});
export type SubtaskCommand = z.infer<typeof SubtaskCommandSchema>;
