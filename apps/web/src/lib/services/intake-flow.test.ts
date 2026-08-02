import { afterEach, describe, expect, it } from "vitest";
import path from "path";
import { promises as fs } from "fs";
import { DevFileRepository } from "@/lib/repositories/dev-file-store";
import { analyzeIntake, confirmIntake, createIntake } from "@/lib/services/intake-service";
import { applyMissionTransition } from "@/lib/services/transition-service";
import { missionIdFromIntake } from "@/lib/ids";

const tmpRoot = path.join(process.cwd(), ".data-test");

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

describe("Idempotency / duplicate intake", () => {
  it("returns the same intake for duplicate idempotency_key", async () => {
    await resetRepo();
    const a = await createIntake(
      {
        raw_request: "Summarize the quarterly docs for leadership",
        idempotency_key: "IDEM-DUP-1",
      },
      "operator:test",
    );
    const b = await createIntake(
      {
        raw_request: "Different text should not create new intake",
        idempotency_key: "IDEM-DUP-1",
      },
      "operator:test",
    );
    expect(b.reused).toBe(true);
    expect(b.bundle.intake_id).toBe(a.bundle.intake_id);
  });

  it("repeat confirm returns same mission_id (C-03)", async () => {
    await resetRepo();
    process.env.NOTION_ADAPTER = "mock";
    process.env.NOTION_MOCK_SUCCESS = "true";
    const { bundle } = await createIntake(
      {
        raw_request: "Draft a research synthesis without secrets",
        idempotency_key: "IDEM-FLOW-1",
      },
      "operator:test",
    );
    await analyzeIntake(bundle.intake_id, "operator:test");
    const first = await confirmIntake(
      bundle.intake_id,
      { sensitivity_acknowledged: true, reason: "confirm" },
      "operator:test",
    );
    expect(first.ok).toBe(true);
    if (!first.ok) return;
    expect(first.mission_id).toBe(
      missionIdFromIntake(bundle.intake_id, bundle.intake_version),
    );

    const second = await confirmIntake(
      bundle.intake_id,
      { sensitivity_acknowledged: true, reason: "confirm again" },
      "operator:test",
    );
    expect(second.ok).toBe(true);
    if (!second.ok) return;
    expect(second.mission_id).toBe(first.mission_id);
    expect(second.reused).toBe(true);
  });

  it("rejects ChatGPT as confirm actor", async () => {
    await resetRepo();
    const { bundle } = await createIntake(
      {
        raw_request: "Outline a public handbook section",
        idempotency_key: "IDEM-CGPT-1",
      },
      "operator:test",
    );
    await analyzeIntake(bundle.intake_id, "operator:test");
    const denied = await confirmIntake(
      bundle.intake_id,
      { reason: "assistant tries to confirm" },
      "chatgpt",
    );
    expect(denied.ok).toBe(false);
    if (!denied.ok) expect(denied.error.code).toBe("ACTOR_NOT_AUTHORIZED");
  });
});

describe("Invalid transition", () => {
  it("rejects illegal transition commands", async () => {
    await resetRepo();
    process.env.NOTION_MOCK_SUCCESS = "true";
    const { bundle } = await createIntake(
      {
        raw_request: "Create a docs outline for the team handbook",
        idempotency_key: "IDEM-TX-1",
      },
      "operator:test",
    );
    await analyzeIntake(bundle.intake_id, "operator:test");
    const confirmed = await confirmIntake(bundle.intake_id, { reason: "go" }, "operator:test");
    expect(confirmed.ok).toBe(true);
    if (!confirmed.ok) return;

    const bad = await applyMissionTransition({
      missionId: confirmed.mission_id,
      command: "mission_ready",
      reason: "illegal from ready",
      actor: "operator:test",
    });
    expect(bad.ok).toBe(false);
    if (!bad.ok) expect(bad.code).toBe("INVALID_TRANSITION");
  });

  it("transition writes full audit and invalidates verification on revision bump", async () => {
    const repo = await resetRepo();
    process.env.NOTION_MOCK_SUCCESS = "true";
    const { bundle } = await createIntake(
      {
        raw_request: "Write an internal SOP for intake operators",
        idempotency_key: "IDEM-TX-2",
      },
      "operator:test",
    );
    await analyzeIntake(bundle.intake_id, "operator:test");
    const confirmed = await confirmIntake(bundle.intake_id, { reason: "go" }, "operator:test");
    expect(confirmed.ok).toBe(true);
    if (!confirmed.ok) return;

    const before = await repo.getNotionSync(confirmed.mission_id);
    expect(before?.verified_by).toBe("operator:test");
    expect(before?.source_record_version).toBe("1");

    const blocked = await applyMissionTransition({
      missionId: confirmed.mission_id,
      command: "mission_block",
      reason: "need clarification",
      actor: "operator:test",
      correlation_id: "COR-TX-2",
      causation_id: "CAUSE-1",
    });
    expect(blocked.ok).toBe(true);

    const audit = await repo.listAudit({ mission_id: confirmed.mission_id });
    const tx = audit.find((e) => e.action === "transition:mission_block");
    expect(tx?.aggregate_type).toBe("mission");
    expect(tx?.causation_id).toBe("CAUSE-1");
    expect(tx?.correlation_id).toBe("COR-TX-2");
    expect(tx?.policy_result.decision).toBe("allow");
    expect(tx?.previous_state).toBe("ready");
    expect(tx?.new_state).toBe("blocked");

    const after = await repo.getNotionSync(confirmed.mission_id);
    expect(after?.verified_by).toBeNull();
    expect(after?.source_record_version).toBeNull();
    expect(["pending", "conflict"]).toContain(after?.sync_status);
  });
});

describe("Intake → confirmation → mission", () => {
  it("creates mission with status=ready and empty subtask_ids", async () => {
    const repo = await resetRepo();
    process.env.NOTION_MOCK_SUCCESS = "true";
    const created = await createIntake(
      {
        raw_request: "Implement a small TypeScript helper and document it",
        constraints: ["No production deploy"],
        idempotency_key: "IDEM-INT-1",
      },
      "operator:test",
    );
    const analyzed = await analyzeIntake(created.bundle.intake_id, "operator:test");
    expect(analyzed.mission_summary.length).toBeGreaterThan(0);
    expect(["needs_input", "awaiting_confirmation"]).toContain(analyzed.readiness_status);

    const result = await confirmIntake(
      analyzed.intake_id,
      { sensitivity_acknowledged: true, reason: "User confirmed" },
      "operator:test",
      "COR-TEST-1",
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.status).toBe("ready");
    expect(result.notion.sync_status).toBe("mock_synced");
    expect(result.notion.notion_page_id).toBeNull();
    expect(result.notion.message).toMatch(/Mock sync only/);

    const mission = await repo.getMissionById(result.mission_id);
    expect(mission?.status).toBe("ready");
    expect(mission?.subtask_ids).toEqual([]);
    expect(mission?.planning_status).toBe("not_started");
    expect(mission?.success_criteria?.join(" ") || "").not.toMatch(/Mission Object created/i);

    const sync = await repo.getNotionSync(result.mission_id);
    expect(sync?.verified_by).toBe("operator:test");
    expect(sync?.verification_method).toBe("user_confirm_mapping");
    expect(sync?.verification_version).toBe("1.0");
    expect(sync?.source_record_version).toBe("1");
    expect(sync?.policy_decision_id).toBeTruthy();
    expect(sync?.sync_attempt_id).toBeTruthy();

    const intake = await repo.getIntakeById(analyzed.intake_id);
    expect(intake?.readiness_status).toBe("ready_to_dispatch");
    expect(intake?.confirmed_by_user).toBe(true);

    const audit = await repo.listAudit({ mission_id: result.mission_id });
    expect(audit.some((e) => e.action === "mapping:accept")).toBe(true);
    expect(audit.some((e) => e.aggregate_type === "notion_sync")).toBe(true);
  });

  it("keeps mission when Notion sync fails", async () => {
    const repo = await resetRepo();
    process.env.NOTION_ADAPTER = "mock";
    process.env.NOTION_MOCK_SUCCESS = "false";
    const { bundle } = await createIntake(
      {
        raw_request: "Prepare a strategy brief for the leadership offsite",
        idempotency_key: "IDEM-FAIL-1",
      },
      "operator:test",
    );
    await analyzeIntake(bundle.intake_id, "operator:test");
    const result = await confirmIntake(bundle.intake_id, { reason: "go" }, "operator:test");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.notion.sync_status).toBe("failed");
    const mission = await repo.getMissionById(result.mission_id);
    expect(mission?.status).toBe("ready");
    process.env.NOTION_MOCK_SUCCESS = "true";
  });
});
