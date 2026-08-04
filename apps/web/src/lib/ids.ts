import { createHash } from "crypto";

export function newIntakeId(): string {
  return `INT-${crypto.randomUUID().replace(/-/g, "").slice(0, 12).toUpperCase()}`;
}

export function newMissionId(): string {
  return `MIS-${crypto.randomUUID().replace(/-/g, "").slice(0, 12).toUpperCase()}`;
}

/**
 * C-03: same confirmed intake_id + intake_version → same mission_id.
 */
export function missionIdFromIntake(intakeId: string, intakeVersion: string): string {
  const digest = createHash("sha256")
    .update(`${intakeId}|${intakeVersion}`)
    .digest("hex")
    .slice(0, 12)
    .toUpperCase();
  return `MIS-${digest}`;
}

export function newCorrelationId(): string {
  return `COR-${crypto.randomUUID()}`;
}

export function newAuditId(): string {
  return crypto.randomUUID();
}

export function newIdempotencyKey(): string {
  return `IDEM-${crypto.randomUUID()}`;
}

export function newSyncAttemptId(): string {
  return `SYNC-${crypto.randomUUID().replace(/-/g, "").slice(0, 12).toUpperCase()}`;
}

export function newPolicyDecisionId(prefix = "PD"): string {
  return `${prefix}-${crypto.randomUUID().replace(/-/g, "").slice(0, 10).toUpperCase()}`;
}

export function newPreflightId(): string {
  return `PF-${crypto.randomUUID().replace(/-/g, "").slice(0, 12).toUpperCase()}`;
}

export function nowIso(): string {
  return new Date().toISOString();
}

/** ChatGPT / assistants may recommend only — never authorize confirm or verified writes alone. */
export function assertOperatorActor(actor: string): void {
  const normalized = actor.trim().toLowerCase();
  if (
    !normalized.startsWith("operator:") ||
    normalized.includes("chatgpt") ||
    normalized === "chatgpt" ||
    normalized.startsWith("assistant:")
  ) {
    throw new Error("ACTOR_NOT_AUTHORIZED");
  }
}
