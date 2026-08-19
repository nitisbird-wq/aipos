import { z } from "zod";

export const MissionStateSchema = z.enum([
  "CAPTURED",
  "UNDERSTOOD",
  "STRATEGIZED",
  "PLANNED",
  "APPROVED",
  "DISPATCHED",
  "EXECUTING",
  "VERIFYING",
  "INTEGRATING",
  "COMPLETED",
  "BLOCKED",
  "FAILED",
  "RECONCILING",
  "WAITING_HUMAN",
  "CANCELLED",
]);
export type MissionState = z.infer<typeof MissionStateSchema>;

export const EvidenceStatusSchema = z.enum([
  "CONFIRMED",
  "REPORTED",
  "INFERRED",
  "HYPOTHESIS",
  "UNKNOWN",
]);
export type EvidenceStatus = z.infer<typeof EvidenceStatusSchema>;

export const EvidenceSchema = z.object({
  claim: z.string().min(1),
  status: EvidenceStatusSchema,
  source: z.string().min(1),
  timestamp: z.string().datetime(),
  freshness: z.string().min(1),
  confidence: z.number().min(0).max(1),
  evidence_ref: z.string().min(1),
  verified_by: z.string().min(1),
});
export type Evidence = z.infer<typeof EvidenceSchema>;

export const ContextClassSchema = z.enum([
  "OWNER",
  "ROLE",
  "SYSTEM",
  "DOMAIN",
  "HISTORICAL",
  "LIVE",
  "EVIDENCE",
]);

export const ContextObjectSchema = z.object({
  id: z.string().min(1),
  context_class: ContextClassSchema,
  domain: z.string().min(1),
  type: z.string().min(1),
  statement: z.string().min(1),
  source: z.string().min(1),
  provenance: z.string().min(1),
  status: EvidenceStatusSchema,
  version: z.string().min(1),
  effective_at: z.string().datetime(),
  freshness: z.string().min(1),
  review_due: z.string().datetime(),
  confidence: z.number().min(0).max(1),
  evidence: z.array(EvidenceSchema),
  owner: z.string().min(1),
  approver: z.string().optional(),
  sensitivity: z.string().min(1),
  access: z.string().min(1),
  supersedes: z.array(z.string()).default([]),
  conflicts_with: z.array(z.string()).default([]),
});
export type ContextObject = z.infer<typeof ContextObjectSchema>;

export const MissionContextPackSchema = z.object({
  mission_id: z.string().min(1),
  generated_at: z.string().datetime(),
  generated_by: z.string().min(1),
  selected_context: z.array(ContextObjectSchema),
  excluded_context_ids: z.array(z.string()),
  rationale: z.string().min(1),
});
export type MissionContextPack = z.infer<typeof MissionContextPackSchema>;

export const MissingInfoClassSchema = z.enum([
  "BLOCKER",
  "SAFE_ASSUMPTION",
  "DISCOVERABLE",
  "OPTIONAL_REFINEMENT",
]);

export const DeliverableContractSchema = z.object({
  deliverable_type: z.string().min(1),
  audience: z.string().min(1),
  purpose: z.string().min(1),
  required_sections: z.array(z.string()).min(1),
  required_artifacts: z.array(z.string()),
  quality_standard: z.string().min(1),
  acceptance_criteria: z.array(z.string()).min(1),
  evidence_requirement: z.string().min(1),
  format: z.string().min(1),
  completion_definition: z.string().min(1),
});
export type DeliverableContract = z.infer<typeof DeliverableContractSchema>;

export const MissionStrategySchema = z.object({
  strategy_id: z.string().min(1),
  mission_id: z.string().min(1),
  objective: z.string().min(1),
  desired_outcome: z.string().min(1),
  final_deliverable: DeliverableContractSchema,
  selected_playbook: z.string().min(1),
  strategy_reasoning: z.array(z.string()).min(1),
  missing_information: z.array(
    z.object({
      kind: MissingInfoClassSchema,
      detail: z.string().min(1),
      owner_question_required: z.boolean(),
    }),
  ),
  backward_plan_summary: z.array(z.string()).min(1),
  decomposition_ready: z.boolean(),
});
export type MissionStrategy = z.infer<typeof MissionStrategySchema>;

export const OwnerInteractionContractSchema = z.object({
  owner_questions_count: z.number().int().min(0),
  human_gate_count: z.number().int().min(0),
  avoidable_questions_count: z.number().int().min(0),
});
export type OwnerInteractionContract = z.infer<typeof OwnerInteractionContractSchema>;

export const WorkstreamStatusSchema = z.enum(["pending", "ready", "blocked", "done", "cancelled"]);

export const OutcomeWorkstreamSchema = z.object({
  workstream_id: z.string().min(1),
  mission_id: z.string().min(1),
  title: z.string().min(1),
  objective: z.string().min(1),
  reason_required: z.string().min(1),
  inputs: z.array(z.string()),
  expected_output: z.array(z.string()).min(1),
  acceptance_criteria: z.array(z.string()).min(1),
  dependencies: z.array(z.string()),
  required_capabilities: z.array(z.string()).min(1),
  risk_level: z.enum(["L0", "L1", "L2", "L3", "L4"]),
  approval_required: z.boolean(),
  parallelizable: z.boolean(),
  execution_order: z.number().int().min(1),
  status: WorkstreamStatusSchema,
});
export type OutcomeWorkstream = z.infer<typeof OutcomeWorkstreamSchema>;

export const AuthorityActionSchema = z.object({
  proposed_action: z.string().min(1),
  reversible: z.boolean(),
  delegated: z.boolean(),
  risk_level: z.enum(["L0", "L1", "L2", "L3", "L4"]),
});

export const AuthorityDecisionSchema = z.object({
  decision: z.enum(["AUTO_AUTHORIZE", "HUMAN_GATE", "DENY"]),
  reason: z.string().min(1),
});
export type AuthorityDecision = z.infer<typeof AuthorityDecisionSchema>;

export const HandoffSchema = z.object({
  handoff_version: z.literal("handoff.v1"),
  mission_id: z.string().min(1),
  mission_state: MissionStateSchema,
  received_context: z.array(z.string()),
  completed_work: z.array(z.string()),
  changes_made: z.array(z.string()),
  verification: z.array(z.string()),
  remaining_work: z.array(z.string()),
  failures: z.array(z.string()),
  decisions: z.array(z.string()),
  assumptions: z.array(z.string()),
  evidence_refs: z.array(z.string()),
  artifacts: z.array(z.string()),
  next_action: z.string().min(1),
  human_action_required: z.string().nullable(),
  risk_notes: z.array(z.string()),
  updated_at: z.string().datetime(),
  updated_by: z.string().min(1),
});
export type Handoff = z.infer<typeof HandoffSchema>;

export const RecoverySchema = z.object({
  recovery_version: z.literal("recovery.v1"),
  sbi: z.object({
    situation: z.string().min(1),
    behavior: z.string().min(1),
    impact: z.string().min(1),
  }),
  grow: z.object({
    goal: z.string().min(1),
    reality: z.string().min(1),
    options: z.array(z.string()).min(1),
    will: z.string().min(1),
  }),
  allowed_recovery: z.enum(["RETRY", "REROUTE", "RECONCILE", "ROLLBACK", "ESCALATE"]),
});
export type RecoveryContract = z.infer<typeof RecoverySchema>;
