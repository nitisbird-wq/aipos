import { z } from "zod";

/** Capability–Connection–Authority Preflight (Phase 2). Mirror packages/schemas/*.json */

export const ToolKindSchema = z.enum(["connector", "agent", "adapter", "local_runtime"]);

export const ToolRegistryEntrySchema = z.object({
  tool_id: z.string().min(1),
  display_name: z.string().min(1),
  kind: ToolKindSchema,
  capability_families: z.array(z.string()).min(1),
  adapter_id: z.string().min(1),
  enabled: z.boolean(),
  connect_instructions: z.string().min(1),
  required_permissions: z.array(z.string()),
  evidence_env_keys: z.array(z.string()).optional(),
  notes: z.string().optional(),
});

export const ToolRegistrySchema = z.array(ToolRegistryEntrySchema);

export const ConnectionStatusSchema = z.enum([
  "not_registered",
  "not_connected",
  "connected_unverified",
  "mock_only",
  "ready_evidenced",
  "unknown_unverified",
]);

export const AuthorityStatusSchema = z.enum([
  "not_applicable",
  "insufficient_permissions",
  "requires_human_approval",
  "policy_blocked",
  "authorized_evidenced",
  "unknown_unverified",
]);

export const PreflightToolResultSchema = z.object({
  tool_id: z.string().min(1),
  display_name: z.string().min(1),
  connection_status: ConnectionStatusSchema,
  authority_status: AuthorityStatusSchema,
  missing_permissions: z.array(z.string()),
  connect_instructions: z.string(),
  selection_reason: z.string(),
  evidence: z.array(z.string()),
});

export const PreflightOverallStatusSchema = z.enum([
  "ready_with_tools",
  "blocked_connector",
  "blocked_permissions",
  "requires_approval",
  "no_tool_user_may_diy",
  "incomplete_evidence",
]);

export const PreflightResultSchema = z.object({
  preflight_id: z.string().regex(/^PF-/),
  intake_id: z.string().regex(/^INT-/),
  evaluated_at: z.string().datetime(),
  capability_families: z.array(z.string()),
  tools: z.array(PreflightToolResultSchema),
  user_diy_allowed: z.boolean(),
  user_diy_reason: z.string(),
  requires_authority_approval: z.boolean(),
  overall_status: PreflightOverallStatusSchema,
  evidence_summary: z.string(),
});

export type ToolRegistryEntry = z.infer<typeof ToolRegistryEntrySchema>;
export type ToolRegistry = z.infer<typeof ToolRegistrySchema>;
export type ConnectionStatus = z.infer<typeof ConnectionStatusSchema>;
export type AuthorityStatus = z.infer<typeof AuthorityStatusSchema>;
export type PreflightToolResult = z.infer<typeof PreflightToolResultSchema>;
export type PreflightOverallStatus = z.infer<typeof PreflightOverallStatusSchema>;
export type PreflightResult = z.infer<typeof PreflightResultSchema>;
