import { z } from "zod";

export const OperatorIdSchema = z.enum([
  "claude",
  "cursor",
  "n8n",
  "notion",
  "linear",
  "human",
]);

export const OperatorOrUnassignedSchema = z.enum([
  "claude",
  "cursor",
  "n8n",
  "notion",
  "linear",
  "human",
  "unassigned",
]);

export const WorkstreamRiskSchema = z.enum(["L0", "L1", "L2", "L3", "L4"]);

export const WorkstreamStatusSchema = z.enum([
  "proposed",
  "awaiting_approval",
  "ready",
  "dispatched",
  "running",
  "succeeded",
  "failed",
  "blocked",
  "cancelled",
]);

export const WorkstreamExpectedOutputSchema = z.object({
  type: z.enum([
    "document",
    "code_pr",
    "linear_update",
    "notion_page",
    "workflow",
    "decision_brief",
    "dataset",
    "other",
  ]),
  location_hint: z
    .enum(["notion", "linear_comment", "github_pr", "n8n_workflow", "chat", "other"])
    .optional(),
  description: z.string().optional(),
});

export const WorkstreamSchema = z.object({
  workstream_id: z.string().regex(/^WS-MIS-[0-9]+-[0-9]{2,}$/),
  mission_id: z.string().regex(/^MIS-[0-9]+$/),
  parent_linear_issue: z.string().nullable().optional(),
  linear_issue_id: z.string().nullable().optional(),
  notion_mission_page_id: z.string().nullable().optional(),
  title: z.string().min(1),
  objective: z.string().min(1),
  required_capabilities: z.array(z.string().min(1)).min(1),
  dependencies: z.array(z.string().regex(/^WS-MIS-[0-9]+-[0-9]{2,}$/)),
  primary_operator: OperatorOrUnassignedSchema,
  supporting_operator: OperatorIdSchema.nullable(),
  tools_required: z.array(z.string()),
  inputs: z.record(z.string(), z.unknown()),
  expected_output: WorkstreamExpectedOutputSchema,
  acceptance_criteria: z.array(z.string().min(1)).min(1),
  risk_level: WorkstreamRiskSchema,
  approval_required: z.boolean(),
  approval_reason: z.string().nullable().optional(),
  execution_order: z.number().int().min(1),
  parallel_group: z.string().nullable().optional(),
  status: WorkstreamStatusSchema,
  correlation_id: z.string().min(1),
  idempotency_key: z.string().min(1),
  canonical_token: z.string().regex(/^AIPOS_WORKSTREAM_ID=WS-MIS-[0-9]+-[0-9]{2,}$/),
  sensitivity_flags: z.array(z.string()).optional(),
  notes: z.string().optional(),
});

export type Workstream = z.infer<typeof WorkstreamSchema>;
export type WorkstreamRisk = z.infer<typeof WorkstreamRiskSchema>;
export type OperatorId = z.infer<typeof OperatorIdSchema>;

export const AutonomyClassSchema = z.enum([
  "auto_dispatch",
  "auto_if_reversible",
  "require_human",
  "fail_closed",
]);

export const DispatchActionSchema = z.enum(["dispatch_now", "await_human", "block"]);

export const RoutingBlockCodeSchema = z.enum([
  "UNKNOWN_CAPABILITY",
  "NO_ELIGIBLE_OPERATOR",
  "OPERATOR_CREDENTIAL_UNVERIFIED",
  "UNKNOWN_AUTHORITY",
  "DOMAIN_CAPABILITY_UNVALIDATED",
  "RISK_REQUIRES_HUMAN",
  "SENSITIVE_EXTERNAL_WRITE",
  "IRREVERSIBLE_ACTION",
  "SECRETS_OR_PRODUCTION_CHANGE",
  "MERGE_OR_DEPLOY",
]);

export const EligibleOperatorSchema = z.object({
  operator: OperatorIdSchema,
  score: z.number().min(0).max(5),
  credential_verified: z.boolean(),
  reasons: z.array(z.string()),
});

export const RoutingDecisionSchema = z.object({
  decision_id: z.string().min(1),
  workstream_id: z.string().regex(/^WS-MIS-[0-9]+-[0-9]{2,}$/),
  mission_id: z.string().regex(/^MIS-[0-9]+$/),
  required_capabilities: z.array(z.string().min(1)).min(1),
  eligible_operators: z.array(EligibleOperatorSchema),
  primary_operator: OperatorOrUnassignedSchema,
  supporting_operator: OperatorIdSchema.nullable(),
  tools_required: z.array(z.string()),
  risk_level: WorkstreamRiskSchema,
  autonomy_class: AutonomyClassSchema,
  approval_required: z.boolean(),
  approval_reason: z.string().nullable().optional(),
  dispatch_action: DispatchActionSchema,
  block_codes: z.array(RoutingBlockCodeSchema).optional(),
  expected_artifact: z.object({
    type: z.string(),
    location_hint: z.string().optional(),
    description: z.string().optional(),
  }),
  acceptance_criteria: z.array(z.string()).min(1),
  reversible: z.boolean().optional(),
  within_delegated_authority: z.boolean().optional(),
  correlation_id: z.string().min(1),
  decided_at: z.string(),
  policy_version: z.literal("ADR-006.D-006.4").optional(),
});

export type RoutingDecision = z.infer<typeof RoutingDecisionSchema>;
export type AutonomyClass = z.infer<typeof AutonomyClassSchema>;
export type DispatchAction = z.infer<typeof DispatchActionSchema>;
export type RoutingBlockCode = z.infer<typeof RoutingBlockCodeSchema>;
