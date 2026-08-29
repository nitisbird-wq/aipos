import { afterEach, describe, expect, it } from "vitest";
import path from "path";
import { promises as fs } from "fs";
import { DevFileRepository } from "@/lib/repositories/dev-file-store";
import {
  getCapabilityRegistryEntry,
  listCapabilityRegistry,
  recordCapabilityRetest,
  saveCapabilityRegistryEntry,
} from "@/lib/services/capability-registry";

const tmpRoot = path.join(process.cwd(), ".data-test-capability-registry");

afterEach(async () => {
  globalThis.__aiposRepo = undefined;
  await fs.rm(tmpRoot, { recursive: true, force: true });
});

function useTestRepository() {
  globalThis.__aiposRepo = new DevFileRepository(tmpRoot);
  globalThis.__aiposPersistenceMode = "dev-file";
}

function verifiedInput() {
  return {
    capability_id: "CAP-DOCS",
    family: "documents",
    name: "Document production",
    description: "Create and verify structured documents",
    status: "VERIFIED" as const,
    enabled: true,
    operators: [
      {
        operator_id: "worker:documents",
        role: "PRIMARY" as const,
        enabled: true,
        evidence_refs: ["evidence:operator-test"],
      },
    ],
    tools: ["document-renderer"],
    evidence_refs: ["evidence:capability-pass"],
    verified_at: "2026-08-29T00:00:00.000Z",
    expires_at: "2027-08-29T00:00:00.000Z",
    retest_due_at: "2027-07-29T00:00:00.000Z",
    last_test_outcome: "PASS" as const,
    actor: "operator:test",
  };
}

// prettier-ignore
describe("Living Capability Registry", () => {
  it("persists immutable revisions and exposes the latest verified truth", async () => {
    useTestRepository();
    const first = await saveCapabilityRegistryEntry(verifiedInput());
    const second = await saveCapabilityRegistryEntry({
      ...verifiedInput(),
      description: "Reverified document production",
    });

    expect(first.revision).toBe(1);
    expect(second.revision).toBe(2);
    expect(second.supersedes_revision).toBe(1);
    expect((await listCapabilityRegistry())).toHaveLength(1);
    expect((await getCapabilityRegistryEntry("CAP-DOCS"))?.description).toBe(
      "Reverified document production",
    );
  });

  it("automatically marks expired capability evidence for re-verification", async () => {
    useTestRepository();
    const expired = await saveCapabilityRegistryEntry({
      ...verifiedInput(),
      expires_at: "2025-08-29T00:00:00.000Z",
    });

    expect(expired.status).toBe("REVERIFY_REQUIRED");
  });

  it("downgrades a failed retest and records a reason", async () => {
    useTestRepository();
    await saveCapabilityRegistryEntry(verifiedInput());
    const degraded = await recordCapabilityRetest({
      capabilityId: "CAP-DOCS",
      outcome: "FAIL",
      evidence_refs: ["evidence:failed-retest"],
      reason: "Renderer verification failed",
      actor: "operator:test",
    });

    expect(degraded.status).toBe("DEGRADED");
    expect(degraded.last_test_outcome).toBe("FAIL");
    expect(degraded.downgrade_reason).toBe("Renderer verification failed");
  });

  it("fails closed when VERIFIED lacks evidence", async () => {
    useTestRepository();
    const unverified = await saveCapabilityRegistryEntry({
      ...verifiedInput(),
      evidence_refs: [],
    });

    expect(unverified.status).toBe("UNVERIFIED");
  });
});
