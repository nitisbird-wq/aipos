import { EvidenceSchema, type Evidence, type EvidenceStatus } from "@/lib/schemas/contracts";

const RANK: Record<EvidenceStatus, number> = {
  UNKNOWN: 0,
  HYPOTHESIS: 1,
  INFERRED: 2,
  REPORTED: 3,
  CONFIRMED: 4,
};

/**
 * Evidence status transitions are explicit and fail-closed.
 * Never silently promote inferred/hypothesis to confirmed.
 */
export function canPromoteEvidence(from: EvidenceStatus, to: EvidenceStatus): boolean {
  if (from === to) return true;
  if (to === "CONFIRMED") {
    return from === "REPORTED" || from === "CONFIRMED";
  }
  return RANK[to] >= RANK[from];
}

export function createEvidence(input: Evidence): Evidence {
  return EvidenceSchema.parse(input);
}

export function promoteEvidence(
  evidence: Evidence,
  to: EvidenceStatus,
  verifiedBy: string,
): { ok: true; evidence: Evidence } | { ok: false; reason: string } {
  if (!canPromoteEvidence(evidence.status, to)) {
    return {
      ok: false,
      reason: `Refuse silent promotion from ${evidence.status} to ${to}; require explicit verification path`,
    };
  }
  return {
    ok: true,
    evidence: EvidenceSchema.parse({
      ...evidence,
      status: to,
      verified_by: verifiedBy,
      timestamp: new Date().toISOString(),
    }),
  };
}

export function assertNoSilentPromotion(claims: Evidence[]): {
  ok: boolean;
  violations: string[];
} {
  const violations = claims
    .filter((c) => c.status === "CONFIRMED" && !c.verified_by)
    .map((c) => `CONFIRMED claim missing verified_by: ${c.claim}`);
  return { ok: violations.length === 0, violations };
}
