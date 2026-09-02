import { z } from "zod";

export const PolicyCandidateKindSchema = z.enum([
  "POLICY",
  "REQUIREMENT",
  "PREFERENCE",
  "CORRECTION",
  "IDEA",
  "DECISION",
]);

export const PolicyCanonicalTargetSchema = z.enum([
  "OWNER_CONSTITUTION",
  "OPERATING_DNA",
  "DOMAIN_PLAYBOOK",
  "PROJECT_POLICY",
]);

export const PolicyInboxStatusSchema = z.enum([
  "INBOX",
  "DUPLICATE",
  "CONFLICT",
  "SUPERSEDED",
  "READY_FOR_PROMOTION",
  "PROMOTED",
  "REJECTED",
]);

export const PolicyCandidateSchema = z.object({
  inbox_version: z.literal("policy-inbox.v1"),
  candidate_id: z.string().min(1),
  revision: z.number().int().positive(),
  fingerprint: z.string().min(1),
  kind: PolicyCandidateKindSchema,
  title: z.string().min(1),
  statement: z.string().min(1),
  scope: z.string().min(1),
  priority: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]),
  confidence: z.number().min(0).max(1),
  source_channel: z.string().min(1),
  source_ref: z.string().min(1),
  source_quote: z.string().min(1).nullable(),
  captured_at: z.string().datetime(),
  captured_by: z.string().min(1),
  effective_at: z.string().datetime().nullable(),
  review_due_at: z.string().datetime().nullable(),
  proposed_target: PolicyCanonicalTargetSchema,
  status: PolicyInboxStatusSchema,
  duplicate_of: z.string().min(1).nullable(),
  conflicts_with: z.array(z.string()),
  supersedes: z.array(z.string()),
  canonical_policy_id: z.string().min(1).nullable(),
  review_reason: z.string().min(1).nullable(),
});

export type PolicyCandidate = z.infer<typeof PolicyCandidateSchema>;
export type PolicyInboxStatus = z.infer<typeof PolicyInboxStatusSchema>;

export const PolicyCoverageRowSchema = z.object({
  channel: z.string().min(1),
  connected: z.boolean(),
  captured_candidates: z.number().int().min(0),
  status: z.enum(["CONNECTED_WITH_DATA", "CONNECTED_NO_DATA", "GAP"]),
  detail: z.string().min(1),
});

export type PolicyCoverageRow = z.infer<typeof PolicyCoverageRowSchema>;
