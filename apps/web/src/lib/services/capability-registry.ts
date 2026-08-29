import { getRepository } from "@/lib/repositories";
import { assertOperatorActor, newAuditId, newCorrelationId, nowIso } from "@/lib/ids";
import {
  CapabilityRegistryEntrySchema,
  type CapabilityRegistryEntry,
  type CapabilityTruthStatus,
} from "@/lib/schemas/capability-registry";
import type { Capability } from "@/lib/schemas/policy";

const REGISTRY_ACTION = "capability_registry:revision";

function entryFromEvent(event: { action: string; policy_result: unknown }) {
  if (event.action !== REGISTRY_ACTION) return null;
  const row = (event.policy_result as { capability_registry_entry?: unknown })
    .capability_registry_entry;
  if (!row) return null;
  return CapabilityRegistryEntrySchema.parse(row);
}

export function effectiveCapabilityStatus(
  entry: CapabilityRegistryEntry,
  at = new Date(),
): CapabilityTruthStatus {
  if (!entry.enabled) return "UNAVAILABLE";
  if (entry.last_test_outcome === "FAIL") return "DEGRADED";
  if (
    entry.expires_at &&
    new Date(entry.expires_at).getTime() <= at.getTime() &&
    ["VERIFIED", "PARTIAL"].includes(entry.status)
  ) {
    return "REVERIFY_REQUIRED";
  }
  if (entry.status === "VERIFIED" && entry.evidence_refs.length === 0) return "UNVERIFIED";
  return entry.status;
}

export async function listCapabilityRegistry(): Promise<CapabilityRegistryEntry[]> {
  const audit = await getRepository().listAudit({});
  const latest = new Map<string, CapabilityRegistryEntry>();
  for (const entry of audit
    .map(entryFromEvent)
    .filter((row): row is CapabilityRegistryEntry => Boolean(row))
    .sort((a, b) => b.revision - a.revision || b.updated_at.localeCompare(a.updated_at))) {
    if (!latest.has(entry.capability_id)) latest.set(entry.capability_id, entry);
  }
  return Array.from(latest.values())
    .map((entry) =>
      CapabilityRegistryEntrySchema.parse({
        ...entry,
        status: effectiveCapabilityStatus(entry),
      }),
    )
    .sort((a, b) => a.family.localeCompare(b.family));
}

export async function getCapabilityRegistryEntry(capabilityId: string) {
  return (await listCapabilityRegistry()).find((entry) => entry.capability_id === capabilityId) ?? null;
}

export async function saveCapabilityRegistryEntry(input: {
  capability_id: string;
  family: string;
  name: string;
  description: string;
  status: CapabilityTruthStatus;
  enabled: boolean;
  operators: CapabilityRegistryEntry["operators"];
  tools: string[];
  evidence_refs: string[];
  verified_at?: string | null;
  expires_at?: string | null;
  retest_due_at?: string | null;
  last_test_outcome?: CapabilityRegistryEntry["last_test_outcome"];
  downgrade_reason?: string | null;
  actor: string;
}): Promise<CapabilityRegistryEntry> {
  assertOperatorActor(input.actor);
  const repo = getRepository();
  const previous = await getCapabilityRegistryEntry(input.capability_id);
  const revision = (previous?.revision ?? 0) + 1;
  const updatedAt = nowIso();
  const entry = CapabilityRegistryEntrySchema.parse({
    registry_version: "capability-registry.v1",
    capability_id: input.capability_id,
    revision,
    family: input.family,
    name: input.name,
    description: input.description,
    status: input.status,
    enabled: input.enabled,
    operators: input.operators,
    tools: input.tools,
    evidence_refs: input.evidence_refs,
    verified_at: input.verified_at ?? null,
    expires_at: input.expires_at ?? null,
    retest_due_at: input.retest_due_at ?? null,
    last_test_outcome: input.last_test_outcome ?? "NOT_RUN",
    downgrade_reason: input.downgrade_reason ?? null,
    supersedes_revision: previous?.revision ?? null,
    updated_at: updatedAt,
    updated_by: input.actor,
  });
  const effectiveStatus = effectiveCapabilityStatus(entry);
  const normalized = CapabilityRegistryEntrySchema.parse({ ...entry, status: effectiveStatus });

  if (normalized.status === "VERIFIED" && !normalized.verified_at) {
    throw new Error("VERIFIED_CAPABILITY_REQUIRES_VERIFIED_AT");
  }
  if (["VERIFIED", "PARTIAL"].includes(normalized.status) && normalized.evidence_refs.length === 0) {
    throw new Error("ROUTABLE_CAPABILITY_REQUIRES_EVIDENCE");
  }
  if (normalized.status === "DEGRADED" && !normalized.downgrade_reason) {
    throw new Error("DEGRADED_CAPABILITY_REQUIRES_REASON");
  }

  await repo.appendAudit({
    id: newAuditId(),
    aggregate_type: "system",
    mission_id: null,
    intake_id: null,
    actor: input.actor,
    action: REGISTRY_ACTION,
    reason: `Capability ${input.capability_id} revision ${revision}: ${normalized.status}`,
    correlation_id: newCorrelationId(),
    causation_id: null,
    previous_state: previous?.status ?? null,
    new_state: normalized.status,
    policy_result: { decision: "allow", capability_registry_entry: normalized },
    created_at: updatedAt,
  });
  return normalized;
}

export async function recordCapabilityRetest(input: {
  capabilityId: string;
  outcome: "PASS" | "PARTIAL" | "FAIL";
  evidence_refs: string[];
  expires_at?: string | null;
  retest_due_at?: string | null;
  reason?: string;
  actor: string;
}) {
  const previous = await getCapabilityRegistryEntry(input.capabilityId);
  if (!previous) throw new Error("CAPABILITY_NOT_FOUND");
  if (input.outcome !== "FAIL" && input.evidence_refs.length === 0) {
    throw new Error("CAPABILITY_RETEST_REQUIRES_EVIDENCE");
  }
  return saveCapabilityRegistryEntry({
    ...previous,
    actor: input.actor,
    status:
      input.outcome === "PASS"
        ? "VERIFIED"
        : input.outcome === "PARTIAL"
          ? "PARTIAL"
          : "DEGRADED",
    evidence_refs: input.evidence_refs,
    verified_at: input.outcome === "FAIL" ? previous.verified_at : nowIso(),
    expires_at: input.expires_at ?? null,
    retest_due_at: input.retest_due_at ?? null,
    last_test_outcome: input.outcome,
    downgrade_reason: input.outcome === "FAIL" ? input.reason || "Capability retest failed" : null,
  });
}

export function registryEntriesToCapabilities(entries: CapabilityRegistryEntry[]): Capability[] {
  return entries.map((entry) => ({
    capability_id: entry.capability_id,
    family: entry.family,
    name: entry.name,
    enabled: entry.enabled,
    status: effectiveCapabilityStatus(entry),
    specialists: entry.operators.map((operator) => ({
      specialist_id: operator.operator_id,
      enabled: operator.enabled,
      role: operator.role,
      evidence_refs: operator.evidence_refs,
    })),
  }));
}
