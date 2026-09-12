import { z } from "zod";

export const CapabilityTruthStatusSchema = z.enum([
  "VERIFIED",
  "PARTIAL",
  "UNVERIFIED",
  "UNAVAILABLE",
  "REVERIFY_REQUIRED",
  "DEGRADED",
]);

export const CapabilityTestOutcomeSchema = z.enum(["PASS", "PARTIAL", "FAIL", "NOT_RUN"]);

export const CapabilityOperatorSchema = z.object({
  operator_id: z.string().min(1),
  role: z.enum(["PRIMARY", "SUPPORT"]),
  enabled: z.boolean(),
  evidence_refs: z.array(z.string()),
});

export const CapabilityRegistryEntrySchema = z.object({
  registry_version: z.literal("capability-registry.v1"),
  capability_id: z.string().min(1),
  revision: z.number().int().positive(),
  family: z.string().min(1),
  name: z.string().min(1),
  description: z.string().min(1),
  status: CapabilityTruthStatusSchema,
  enabled: z.boolean(),
  operators: z.array(CapabilityOperatorSchema),
  tools: z.array(z.string()),
  evidence_refs: z.array(z.string()),
  verified_at: z.string().datetime().nullable(),
  expires_at: z.string().datetime().nullable(),
  retest_due_at: z.string().datetime().nullable(),
  last_test_outcome: CapabilityTestOutcomeSchema,
  downgrade_reason: z.string().min(1).nullable(),
  supersedes_revision: z.number().int().positive().nullable(),
  updated_at: z.string().datetime(),
  updated_by: z.string().min(1),
});

export type CapabilityTruthStatus = z.infer<typeof CapabilityTruthStatusSchema>;
export type CapabilityRegistryEntry = z.infer<typeof CapabilityRegistryEntrySchema>;
