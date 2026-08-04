import { z } from "zod";

export const ToolKindSchema = z.enum(["connector", "agent", "runtime", "adapter"]);

export const ToolRegistryEntrySchema = z.object({
  tool_id: z.string().min(1),
  display_name: z.string().min(1),
  kind: ToolKindSchema,
  capability_ids: z.array(z.string()),
  capability_families: z.array(z.string()).optional(),
  enabled: z.boolean(),
  required_permissions: z.array(z.string()),
  connect_instructions: z.string().min(1),
  credential_env_keys: z.array(z.string()).optional(),
  allows_manual_fallback: z.boolean(),
  execution_phase: z.enum(["phase3_or_later", "intake_support", "none"]),
  notes: z.string().optional(),
});

export type ToolRegistryEntry = z.infer<typeof ToolRegistryEntrySchema>;

export const ConnectionStatusCodeSchema = z.enum([
  "unknown",
  "not_configured",
  "credential_present",
  "mock_only",
  "disconnected",
  "connected",
  "error",
]);

export const ConnectionStatusSchema = z
  .object({
    tool_id: z.string().min(1),
    status: ConnectionStatusCodeSchema,
    probed_at: z.string(),
    evidence: z.object({
      method: z.enum([
        "env_presence",
        "adapter_mode",
        "explicit_disconnected",
        "live_probe",
        "none",
      ]),
      summary: z.string(),
      probe_id: z.string().nullable().optional(),
      adapter_mode: z.string().nullable().optional(),
      env_keys_present: z.array(z.string()).optional(),
    }),
    claims: z.object({
      connected: z.boolean(),
      verified: z.boolean(),
    }),
    connect_instructions: z.string().nullable().optional(),
    error: z.string().nullable().optional(),
  })
  .superRefine((value, ctx) => {
    if (value.claims.connected && value.status !== "connected") {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "claims.connected requires status=connected",
      });
    }
    if (value.claims.connected && !value.evidence.probe_id) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "claims.connected requires evidence.probe_id",
      });
    }
    if (value.claims.verified && value.status === "mock_only") {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "mock_only cannot claim verified",
      });
    }
  });

export type ConnectionStatus = z.infer<typeof ConnectionStatusSchema>;

export const AuthorityStatusCodeSchema = z.enum([
  "unknown",
  "not_authorized",
  "insufficient",
  "requires_approval",
  "authorized",
]);

export const AuthorityStatusSchema = z
  .object({
    tool_id: z.string().min(1),
    status: AuthorityStatusCodeSchema,
    missing_permissions: z.array(z.string()),
    required_approvals: z.array(z.string()),
    claims: z.object({
      authorized: z.boolean(),
    }),
    grant_evidence: z
      .object({
        method: z.string(),
        summary: z.string(),
        granted_permissions: z.array(z.string()).optional(),
      })
      .nullable()
      .optional(),
    assessed_at: z.string(),
    notes: z.string().nullable().optional(),
  })
  .superRefine((value, ctx) => {
    if (value.claims.authorized && value.status !== "authorized") {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "claims.authorized requires status=authorized",
      });
    }
    if (value.claims.authorized && !value.grant_evidence) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "claims.authorized requires grant_evidence",
      });
    }
  });

export type AuthorityStatus = z.infer<typeof AuthorityStatusSchema>;

export const PreflightDispositionSchema = z.enum([
  "ready_for_assignment",
  "connect_required",
  "permission_required",
  "approval_required",
  "manual_fallback_allowed",
  "blocked",
]);

export const PreflightUserActionSchema = z.object({
  code: z.enum([
    "CONNECT_TOOL",
    "GRANT_PERMISSION",
    "OBTAIN_APPROVAL",
    "NO_TOOL_USE_MANUAL",
    "WAIT_PHASE3_EXECUTION",
    "NONE",
  ]),
  tool_id: z.string().nullable().optional(),
  missing_permissions: z.array(z.string()).optional(),
  message: z.string(),
  connect_instructions: z.string().nullable().optional(),
});

export const PreflightResultSchema = z.object({
  preflight_id: z.string().min(1),
  schema_version: z.literal("1.0.0"),
  intake_id: z.string().regex(/^INT-/),
  mission_id: z.string().regex(/^MIS-/).nullable(),
  evaluated_at: z.string(),
  operational_risk: z.enum(["L0", "L1", "L2", "L3", "L4"]).optional(),
  capability_families: z.array(z.string()),
  candidate_tools: z.array(z.string()),
  connection_results: z.array(ConnectionStatusSchema),
  authority_results: z.array(AuthorityStatusSchema),
  selected_tool_id: z.string().nullable(),
  selection_reason: z.string().min(1),
  disposition: PreflightDispositionSchema,
  user_actions: z.array(PreflightUserActionSchema),
  manual_fallback: z.object({
    allowed: z.boolean(),
    reason: z.string(),
  }),
  claims: z.object({
    any_connected: z.boolean(),
    any_authorized: z.boolean(),
    any_verified: z.boolean(),
  }),
  blocking_codes: z.array(z.string()),
  assignment_execution_blocked: z.boolean().optional(),
});

export type PreflightResult = z.infer<typeof PreflightResultSchema>;
