import { afterEach, describe, expect, it } from "vitest";
import path from "path";
import { promises as fs } from "fs";
import { DevFileRepository } from "@/lib/repositories/dev-file-store";
import { analyzeIntake, confirmIntake, createIntake } from "@/lib/services/intake-service";
import { retryNotionSync } from "@/lib/services/notion-sync-service";
import { applyNotionWriteResult } from "@/lib/services/notion-sync-service";
import { MockNotionAdapter } from "@/lib/notion/client";
import { nowIso } from "@/lib/ids";

const tmpRoot = path.join(process.cwd(), ".data-test-notion");

async function resetRepo() {
  await fs.rm(tmpRoot, { recursive: true, force: true });
  const repo = new DevFileRepository(tmpRoot);
  globalThis.__aiposRepo = repo;
  globalThis.__aiposPersistenceMode = "dev-file";
  return repo;
}

afterEach(async () => {
  globalThis.__aiposRepo = undefined;
  await fs.rm(tmpRoot, { recursive: true, force: true });
});

async function createReadyMission(key: string) {
  process.env.NOTION_ADAPTER = "mock";
  process.env.NOTION_MOCK_SUCCESS = "true";
  const { bundle } = await createIntake(
    {
      raw_request: "Document the onboarding checklist for new operators",
      idempotency_key: key,
    },
    "operator:test",
  );
  await analyzeIntake(bundle.intake_id, "operator:test");
  const confirmed = await confirmIntake(bundle.intake_id, { reason: "confirm" }, "operator:test");
  expect(confirmed.ok).toBe(true);
  if (!confirmed.ok) throw new Error("confirm failed");
  return confirmed;
}

describe("mock sync labeling", () => {
  it("stores mock_synced with verification metadata", async () => {
    const repo = await resetRepo();
    const confirmed = await createReadyMission("IDEM-MOCK-1");
    expect(confirmed.notion.sync_status).toBe("mock_synced");
    expect(confirmed.notion.notion_page_id).toBeNull();
    expect(confirmed.notion.message).toMatch(/Mock sync only/);

    const sync = await repo.getNotionSync(confirmed.mission_id);
    expect(sync?.sync_status).toBe("mock_synced");
    expect(sync?.notion_page_id).toBeNull();
    expect(sync?.verified_by).toBe("operator:test");
    expect(sync?.verification_method).toBe("user_confirm_mapping");
    expect(sync?.source_record_version).toBe("1");
  });

  it("applyNotionWriteResult labels mock distinctly from verified", async () => {
    const mock = await new MockNotionAdapter().createOrUpdateMissionPage({
      mission_id: "MIS-TEST",
    });
    const applied = applyNotionWriteResult("MIS-TEST", mock, {
      verified_by: "operator:test",
      verified_at: nowIso(),
      verification_method: "user_confirm_mapping",
      verification_version: "1.0",
      source_record_version: "1",
      policy_decision_id: "PD-1",
      sync_attempt_id: "SYNC-1",
    });
    expect(applied.sync_status).toBe("mock_synced");
    expect(applied.message).toBe("Mock sync only — no external Notion record was created.");
    expect(applied.notion_page_id).toBeNull();
    expect(applied.verified_by).toBe("operator:test");
  });

  it("reuses existing notion_page_id on retry (no duplicate page)", async () => {
    const repo = await resetRepo();
    const confirmed = await createReadyMission("IDEM-REUSE-1");
    await repo.saveNotionSync({
      mission_id: confirmed.mission_id,
      notion_page_id: "page-existing-abc",
      sync_status: "failed",
      sync_attempt_id: "SYNC-OLD",
      verified_by: "operator:test",
      verified_at: nowIso(),
      verification_method: "user_confirm_mapping",
      verification_version: "1.0",
      source_record_version: "1",
      policy_decision_id: "PD-OLD",
      last_error: "temporary",
      synced_at: null,
      updated_at: nowIso(),
    });

    const retried = await retryNotionSync({
      missionId: confirmed.mission_id,
      actor: "operator:test",
    });
    expect(retried.ok).toBe(true);
    const sync = await repo.getNotionSync(confirmed.mission_id);
    expect(sync?.notion_page_id).toBe("page-existing-abc");
  });
});

describe("retry Notion sync rules", () => {
  it("retry available only from failed", async () => {
    const repo = await resetRepo();
    const confirmed = await createReadyMission("IDEM-RETRY-1");
    const rejected = await retryNotionSync({
      missionId: confirmed.mission_id,
      actor: "operator:test",
    });
    expect(rejected.ok).toBe(false);
    if (!rejected.ok) {
      expect(rejected.code).toBe("RETRY_NOT_ALLOWED");
      expect(rejected.sync_status).toBe("mock_synced");
    }

    await repo.saveNotionSync({
      mission_id: confirmed.mission_id,
      notion_page_id: null,
      sync_status: "failed",
      sync_attempt_id: null,
      verified_by: null,
      verified_at: null,
      verification_method: null,
      verification_version: null,
      source_record_version: null,
      policy_decision_id: null,
      last_error: "forced failure for test",
      synced_at: null,
      updated_at: nowIso(),
    });

    const allowed = await retryNotionSync({
      missionId: confirmed.mission_id,
      actor: "operator:test",
    });
    expect(allowed.ok).toBe(true);
    if (allowed.ok) {
      expect(allowed.notion.sync_status).toBe("mock_synced");
      expect(allowed.notion.message).toMatch(/Mock sync only/);
    }

    const audit = await repo.listAudit({ mission_id: confirmed.mission_id });
    expect(audit.some((e) => e.action === "notion:retry_mock_synced")).toBe(true);
  });

  it("rejects retry from synced without force", async () => {
    const repo = await resetRepo();
    const confirmed = await createReadyMission("IDEM-RETRY-2");
    await repo.saveNotionSync({
      mission_id: confirmed.mission_id,
      notion_page_id: "real-page-abc",
      sync_status: "synced",
      sync_attempt_id: "SYNC-1",
      verified_by: "operator:test",
      verified_at: nowIso(),
      verification_method: "user_confirm_mapping",
      verification_version: "1.0",
      source_record_version: "1",
      policy_decision_id: "PD-1",
      last_error: null,
      synced_at: nowIso(),
      updated_at: nowIso(),
    });

    const rejected = await retryNotionSync({
      missionId: confirmed.mission_id,
      actor: "operator:test",
    });
    expect(rejected.ok).toBe(false);
    if (!rejected.ok) {
      expect(rejected.code).toBe("RETRY_NOT_ALLOWED");
      expect(rejected.sync_status).toBe("synced");
    }

    const before = await repo.listAudit({ mission_id: confirmed.mission_id });
    const retrySuccessCount = before.filter((e) => e.action === "notion:retry_success").length;

    const forced = await retryNotionSync({
      missionId: confirmed.mission_id,
      actor: "operator:test",
      force: true,
    });
    expect(forced.ok).toBe(true);

    const after = await repo.listAudit({ mission_id: confirmed.mission_id });
    expect(after.filter((e) => e.action === "notion:retry_success").length).toBe(retrySuccessCount);
  });

  it("rejects retry from pending", async () => {
    const repo = await resetRepo();
    const confirmed = await createReadyMission("IDEM-RETRY-3");
    await repo.saveNotionSync({
      mission_id: confirmed.mission_id,
      notion_page_id: null,
      sync_status: "pending",
      sync_attempt_id: null,
      verified_by: null,
      verified_at: null,
      verification_method: null,
      verification_version: null,
      source_record_version: null,
      policy_decision_id: null,
      last_error: null,
      synced_at: null,
      updated_at: nowIso(),
    });
    const rejected = await retryNotionSync({
      missionId: confirmed.mission_id,
      actor: "operator:test",
    });
    expect(rejected.ok).toBe(false);
    if (!rejected.ok) expect(rejected.code).toBe("RETRY_NOT_ALLOWED");
  });
});
