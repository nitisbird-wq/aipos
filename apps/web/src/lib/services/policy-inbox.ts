import { createHash } from "crypto";
import { getRepository } from "@/lib/repositories";
import { assertOperatorActor, newAuditId, newCorrelationId, nowIso } from "@/lib/ids";
import {
  PolicyCandidateSchema,
  PolicyCoverageRowSchema,
  type PolicyCandidate,
  type PolicyCoverageRow,
} from "@/lib/schemas/policy-inbox";

const POLICY_INBOX_ACTIONS = new Set([
  "policy_inbox:captured",
  "policy_inbox:reviewed",
  "policy_inbox:promotion_approved",
]);

// prettier-ignore
function digest(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

// prettier-ignore
function normalize(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

// prettier-ignore
function candidateFromEvent(event: { action: string; policy_result: unknown }) {
  if (!POLICY_INBOX_ACTIONS.has(event.action)) return null;
  const row = (event.policy_result as { policy_candidate?: unknown }).policy_candidate;
  return row ? PolicyCandidateSchema.parse(row) : null;
}

// prettier-ignore
export async function listPolicyCandidates(): Promise<PolicyCandidate[]> {
  const audit = await getRepository().listAudit({});
  const latest = new Map<string, PolicyCandidate>();
  for (const candidate of audit
    .map(candidateFromEvent)
    .filter((row): row is PolicyCandidate => Boolean(row))
    .sort((a, b) => b.revision - a.revision || b.captured_at.localeCompare(a.captured_at))) {
    if (!latest.has(candidate.candidate_id)) latest.set(candidate.candidate_id, candidate);
  }
  return Array.from(latest.values()).sort((a, b) => b.captured_at.localeCompare(a.captured_at));
}

// prettier-ignore
export async function getPolicyCandidate(candidateId: string) {
  return (await listPolicyCandidates()).find((row) => row.candidate_id === candidateId) ?? null;
}

// prettier-ignore
async function appendCandidateEvent(input: {
  candidate: PolicyCandidate;
  actor: string;
  action: "policy_inbox:captured" | "policy_inbox:reviewed" | "policy_inbox:promotion_approved";
  reason: string;
}) {
  await getRepository().appendAudit({
    id: newAuditId(),
    aggregate_type: "policy",
    mission_id: null,
    intake_id: null,
    actor: input.actor,
    action: input.action,
    reason: input.reason,
    correlation_id: newCorrelationId(),
    causation_id: null,
    previous_state: null,
    new_state: input.candidate.status,
    policy_result: { decision: "allow", policy_candidate: input.candidate },
    created_at: nowIso(),
  });
}

// prettier-ignore
export async function capturePolicyCandidate(input: {
  kind: PolicyCandidate["kind"];
  title: string;
  statement: string;
  scope: string;
  priority: PolicyCandidate["priority"];
  confidence: number;
  source_channel: string;
  source_ref: string;
  source_quote?: string | null;
  effective_at?: string | null;
  review_due_at?: string | null;
  proposed_target: PolicyCandidate["proposed_target"];
  conflicts_with?: string[];
  supersedes?: string[];
  actor: string;
}) {
  const all = await listPolicyCandidates();
  const fingerprint = digest(
    [normalize(input.kind), normalize(input.scope), normalize(input.statement)].join("|"),
  );
  const idempotent = all.find(
    (candidate) =>
      candidate.fingerprint === fingerprint && candidate.source_ref === input.source_ref,
  );
  if (idempotent) return idempotent;

  const duplicate = all.find(
    (candidate) =>
      candidate.fingerprint === fingerprint &&
      !["REJECTED", "SUPERSEDED"].includes(candidate.status),
  );
  const conflictsWith = Array.from(new Set(input.conflicts_with ?? []));
  const candidateId = `PIN-${fingerprint.slice(0, 12)}-${digest(input.source_ref).slice(0, 6)}`;
  const capturedAt = nowIso();
  const candidate = PolicyCandidateSchema.parse({
    inbox_version: "policy-inbox.v1",
    candidate_id: candidateId,
    revision: 1,
    fingerprint,
    kind: input.kind,
    title: input.title,
    statement: input.statement,
    scope: input.scope,
    priority: input.priority,
    confidence: input.confidence,
    source_channel: input.source_channel,
    source_ref: input.source_ref,
    source_quote: input.source_quote ?? null,
    captured_at: capturedAt,
    captured_by: input.actor,
    effective_at: input.effective_at ?? null,
    review_due_at: input.review_due_at ?? null,
    proposed_target: input.proposed_target,
    status: duplicate ? "DUPLICATE" : conflictsWith.length > 0 ? "CONFLICT" : "INBOX",
    duplicate_of: duplicate?.candidate_id ?? null,
    conflicts_with: conflictsWith,
    supersedes: Array.from(new Set(input.supersedes ?? [])),
    canonical_policy_id: null,
    review_reason: null,
  });
  await appendCandidateEvent({
    candidate,
    actor: input.actor,
    action: "policy_inbox:captured",
    reason: duplicate
      ? `Duplicate of ${duplicate.candidate_id}`
      : conflictsWith.length > 0
        ? "Captured with declared conflicts"
        : "Policy candidate captured with provenance",
  });
  return candidate;
}

// prettier-ignore
export async function reviewPolicyCandidate(input: {
  candidateId: string;
  decision: "READY_FOR_PROMOTION" | "REJECTED" | "SUPERSEDED";
  reason: string;
  actor: string;
}) {
  assertOperatorActor(input.actor);
  const previous = await getPolicyCandidate(input.candidateId);
  if (!previous) throw new Error("POLICY_CANDIDATE_NOT_FOUND");
  if (input.decision === "READY_FOR_PROMOTION") {
    if (previous.status === "DUPLICATE") throw new Error("DUPLICATE_POLICY_CANNOT_PROMOTE");
    if (previous.status === "CONFLICT" || previous.conflicts_with.length > 0) {
      throw new Error("POLICY_CONFLICT_REQUIRES_RESOLUTION");
    }
    if (!previous.source_ref || previous.confidence < 0.8) {
      throw new Error("POLICY_PROVENANCE_GATE_FAILED");
    }
  }
  const candidate = PolicyCandidateSchema.parse({
    ...previous,
    revision: previous.revision + 1,
    status: input.decision,
    review_reason: input.reason,
  });
  await appendCandidateEvent({
    candidate,
    actor: input.actor,
    action: "policy_inbox:reviewed",
    reason: input.reason,
  });
  return candidate;
}

// prettier-ignore
export async function approvePolicyPromotion(input: {
  candidateId: string;
  canonicalPolicyId: string;
  reason: string;
  actor: string;
}) {
  assertOperatorActor(input.actor);
  const previous = await getPolicyCandidate(input.candidateId);
  if (!previous) throw new Error("POLICY_CANDIDATE_NOT_FOUND");
  if (previous.status !== "READY_FOR_PROMOTION") {
    throw new Error("POLICY_PROMOTION_APPROVAL_REQUIRED");
  }
  const candidate = PolicyCandidateSchema.parse({
    ...previous,
    revision: previous.revision + 1,
    status: "PROMOTED",
    canonical_policy_id: input.canonicalPolicyId,
    review_reason: input.reason,
  });
  await appendCandidateEvent({
    candidate,
    actor: input.actor,
    action: "policy_inbox:promotion_approved",
    reason: input.reason,
  });
  return candidate;
}

// prettier-ignore
export function buildPolicyCoverageReport(input: {
  expectedChannels: string[];
  connectedChannels: string[];
  candidates: PolicyCandidate[];
}): PolicyCoverageRow[] {
  const connected = new Set(input.connectedChannels.map(normalize));
  return input.expectedChannels.map((channel) => {
    const isConnected = connected.has(normalize(channel));
    const captured = input.candidates.filter(
      (candidate) => normalize(candidate.source_channel) === normalize(channel),
    ).length;
    return PolicyCoverageRowSchema.parse({
      channel,
      connected: isConnected,
      captured_candidates: captured,
      status: !isConnected
        ? "GAP"
        : captured > 0
          ? "CONNECTED_WITH_DATA"
          : "CONNECTED_NO_DATA",
      detail: !isConnected
        ? "Channel is not connected; AIPOS cannot inspect or claim coverage"
        : captured > 0
          ? `${captured} candidate(s) captured with provenance`
          : "Channel is connected but no candidate has been captured",
    });
  });
}
