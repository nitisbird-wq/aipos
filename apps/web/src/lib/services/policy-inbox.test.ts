import { afterEach, describe, expect, it } from "vitest";
import path from "path";
import { promises as fs } from "fs";
import { DevFileRepository } from "@/lib/repositories/dev-file-store";
import {
  approvePolicyPromotion,
  buildPolicyCoverageReport,
  capturePolicyCandidate,
  listPolicyCandidates,
  reviewPolicyCandidate,
} from "@/lib/services/policy-inbox";

const tmpRoot = path.join(process.cwd(), ".data-test-policy-inbox");

afterEach(async () => {
  globalThis.__aiposRepo = undefined;
  await fs.rm(tmpRoot, { recursive: true, force: true });
});

function useTestRepository() {
  globalThis.__aiposRepo = new DevFileRepository(tmpRoot);
  globalThis.__aiposPersistenceMode = "dev-file";
}

function candidateInput(sourceRef: string) {
  return {
    kind: "POLICY" as const,
    title: "Require evidence before shipped status",
    statement: "Do not report shipped status without runtime evidence",
    scope: "aipos.delivery",
    priority: "HIGH" as const,
    confidence: 0.95,
    source_channel: "chatgpt",
    source_ref: sourceRef,
    source_quote: "No shipped status without runtime evidence",
    proposed_target: "OPERATING_DNA" as const,
    actor: "operator:test",
  };
}

// prettier-ignore
describe("Policy Inbox and Consolidation", () => {
  it("is idempotent per source and marks cross-source duplicates", async () => {
    useTestRepository();
    const first = await capturePolicyCandidate(candidateInput("chat://session-1#message-1"));
    const repeated = await capturePolicyCandidate(candidateInput("chat://session-1#message-1"));
    const duplicate = await capturePolicyCandidate(candidateInput("claude://session-2#message-4"));

    expect(repeated.candidate_id).toBe(first.candidate_id);
    expect(duplicate.status).toBe("DUPLICATE");
    expect(duplicate.duplicate_of).toBe(first.candidate_id);
    expect(await listPolicyCandidates()).toHaveLength(2);
  });

  it("blocks unresolved conflict from canonical promotion", async () => {
    useTestRepository();
    const base = await capturePolicyCandidate(candidateInput("chat://base"));
    const conflict = await capturePolicyCandidate({
      ...candidateInput("chat://conflict"),
      statement: "Allow shipped status from self-report only",
      conflicts_with: [base.candidate_id],
    });

    expect(conflict.status).toBe("CONFLICT");
    await expect(
      reviewPolicyCandidate({
        candidateId: conflict.candidate_id,
        decision: "READY_FOR_PROMOTION",
        reason: "attempt promotion",
        actor: "operator:test",
      }),
    ).rejects.toThrow("POLICY_CONFLICT_REQUIRES_RESOLUTION");
  });

  it("requires an explicit review event before canonical promotion", async () => {
    useTestRepository();
    const captured = await capturePolicyCandidate(candidateInput("chat://promotion"));
    await expect(
      approvePolicyPromotion({
        candidateId: captured.candidate_id,
        canonicalPolicyId: "AIPOS-POL-001",
        reason: "approve",
        actor: "operator:test",
      }),
    ).rejects.toThrow("POLICY_PROMOTION_APPROVAL_REQUIRED");

    const ready = await reviewPolicyCandidate({
      candidateId: captured.candidate_id,
      decision: "READY_FOR_PROMOTION",
      reason: "provenance and scope reviewed",
      actor: "operator:test",
    });
    const promoted = await approvePolicyPromotion({
      candidateId: ready.candidate_id,
      canonicalPolicyId: "AIPOS-POL-001",
      reason: "Owner-authorized canonical promotion",
      actor: "operator:test",
    });

    expect(promoted.status).toBe("PROMOTED");
    expect(promoted.canonical_policy_id).toBe("AIPOS-POL-001");
    expect(promoted.revision).toBe(3);
  });

  it("reports unconnected channels as explicit coverage gaps", async () => {
    useTestRepository();
    const candidate = await capturePolicyCandidate(candidateInput("chat://coverage"));
    const report = buildPolicyCoverageReport({
      expectedChannels: ["chatgpt", "claude", "n8n"],
      connectedChannels: ["chatgpt", "claude"],
      candidates: [candidate],
    });

    expect(report).toEqual([
      expect.objectContaining({ channel: "chatgpt", status: "CONNECTED_WITH_DATA" }),
      expect.objectContaining({ channel: "claude", status: "CONNECTED_NO_DATA" }),
      expect.objectContaining({ channel: "n8n", status: "GAP" }),
    ]);
  });
});
