import { z } from "zod";
import { OperationalRiskSchema, SensitivityFlagSchema } from "./intake";

export const MissionStatusSchema = z.enum([
  "draft",
  "ready",
  "understanding",
  "active",
  "blocked",
  "cancelled",
  "closed",
]);
export type MissionStatus = z.infer<typeof MissionStatusSchema>;
// `active`, `closed` added under ADR-005 (Phase 3a coarse status, D-005.3).
// `closed` is reserved — not reachable until a Closeout ADR ships.
// `draft` / `understanding` remain reserved legacy values (ADR-005 D-005.3).

export const PlanningStatusSchema = z.enum([
  "not_started",
  "in_progress",
  "blocked",
  "completed",
  "replanning",
  "failed",
]);
export type PlanningStatus = z.infer<typeof PlanningStatusSchema>;

export const MissionObjectSchema = z
  .object({
    mission_id: z.string().regex(/^MIS-/),
    object_version: z.literal("1.0"),
    revision: z.number().int().min(1),
    source_intake_id: z.string().regex(/^INT-/),
    source_intake_version: z.string(),
    mapping_version: z.literal("1.0"),
    status: MissionStatusSchema,
    status_before_block: MissionStatusSchema.nullable().optional(),
    planning_status: PlanningStatusSchema,
    planning_revision: z.number().int().min(0),
    last_planned_at: z.string().nullable(),
    planning_reason: z.string().nullable(),
    criticality: z.enum(["low", "normal", "high", "critical"]),
    subtask_ids: z.array(z.string()),
    current_blockers: z.array(z.unknown()),
    approval_policy_refs: z.array(z.string()),
    anticipated_approval_points: z.array(z.string()),
    evidence_refs: z.array(z.string()),
    title: z.string().optional(),
    mission_summary: z.string().optional(),
    desired_outcome: z.string().optional(),
    success_criteria: z.array(z.string()).optional(),
    constraints: z.array(z.string()).optional(),
    deadline: z.string().nullable().optional(),
    operational_risk: OperationalRiskSchema.optional(),
    sensitivity_flags: z.array(SensitivityFlagSchema).optional(),
    governance: z.record(z.string(), z.unknown()).optional(),
    planning_input: z.record(z.string(), z.unknown()).optional(),
    intake_evidence: z.record(z.string(), z.unknown()).optional(),
    gate_results: z.record(z.string(), z.unknown()).optional(),
  })
  .refine((m) => !("assigned_specialist" in m), {
    message: "assigned_specialist is forbidden",
  })
  .refine((m) => !("provider_model" in m), {
    message: "provider_model is forbidden",
  })
  .refine((m) => !("retry_count" in m), {
    message: "retry_count is forbidden",
  });

export type MissionObject = z.infer<typeof MissionObjectSchema>;

/** Package transition-command names + short aliases used by UI. */
export const TransitionCommandSchema = z.object({
  command: z.enum([
    "mission_block",
    "mission_cancel",
    "mission_ready",
    "block",
    "unblock",
    "cancel",
  ]),
  reason: z.string().min(1),
  correlation_id: z.string().min(1).optional(),
  causation_id: z.string().min(1).optional(),
});

export type TransitionCommand = z.infer<typeof TransitionCommandSchema>;

export type CanonicalTransitionCommand = "mission_block" | "mission_cancel" | "mission_ready";

export function canonicalizeTransitionCommand(
  command: TransitionCommand["command"],
): CanonicalTransitionCommand {
  if (command === "block" || command === "mission_block") return "mission_block";
  if (command === "cancel" || command === "mission_cancel") return "mission_cancel";
  return "mission_ready";
}

export const NotionSyncStatusSchema = z.enum([
  "not_started",
  "pending",
  "synced",
  "mock_synced",
  "failed",
  "conflict",
]);
export type NotionSyncStatus = z.infer<typeof NotionSyncStatusSchema>;

export const VerificationMethodSchema = z.enum([
  "user_confirm_mapping",
  "manual_retry",
  "diagnostic_force",
]);
export type VerificationMethod = z.infer<typeof VerificationMethodSchema>;

export const NotionSyncRecordSchema = z.object({
  mission_id: z.string(),
  notion_page_id: z.string().nullable(),
  sync_status: NotionSyncStatusSchema,
  sync_attempt_id: z.string().nullable(),
  verified_by: z.string().nullable(),
  verified_at: z.string().nullable(),
  verification_method: VerificationMethodSchema.nullable(),
  verification_version: z.string().nullable(),
  source_record_version: z.string().nullable(),
  policy_decision_id: z.string().nullable(),
  last_error: z.string().nullable(),
  synced_at: z.string().nullable(),
  updated_at: z.string(),
});

export type NotionSyncRecord = z.infer<typeof NotionSyncRecordSchema>;
