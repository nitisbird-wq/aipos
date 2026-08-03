import { afterAll, afterEach, describe, expect, it } from "vitest";
import path from "path";
import { promises as fs } from "fs";
import postgres from "postgres";
import { newAuditId, newCorrelationId, newIdempotencyKey, newIntakeId, nowIso } from "@/lib/ids";
import type { IntakeMissionBundle } from "@/lib/schemas/intake";
import type { MissionObject, NotionSyncRecord } from "@/lib/schemas/mission";
import { DevFileRepository } from "@/lib/repositories/dev-file-store";
import { PostgresRepository } from "@/lib/repositories/postgres-store";
import type { Repository } from "@/lib/repositories/types";
import { closeDb } from "@/lib/db/client";

const tmpRoot = path.join(process.cwd(), ".data-test-repo-contract");

const pgUrl =
  process.env.AIPOS_TEST_DATABASE_URL?.trim() ||
  (process.env.AIPOS_RUN_PG_TESTS === "true" ? process.env.DATABASE_URL?.trim() : undefined);

function sampleIntake(overrides: Partial<IntakeMissionBundle> = {}): IntakeMissionBundle {
  const now = nowIso();
  const intakeId = overrides.intake_id ?? newIntakeId();
  return {
    intake_id: intakeId,
    intake_version: "1.0",
    requester_id: "operator:test",
    source: "web_app",
    source_message_ref: `web:${intakeId}`,
    raw_request: "Prepare a competitive analysis report",
    mission_summary: "Competitive analysis",
    desired_outcome: "Deliver competitive analysis",
    success_criteria: ["Report delivered"],
    constraints: [],
    assumptions: [],
    missing_blockers: [],
    draft_workstreams: [],
    capability_families: ["docs"],
    operational_risk: "L0",
    sensitivity_flags: [],
    sensitivity_acknowledged: true,
    approval_requirements: [],
    knowledge_refs: [],
    attachments: [],
    data_destinations: [
      {
        system: "intake_channel",
        trust_class: "approved_private",
        purpose: "chat_only",
        persistence: "conversation_only",
        external_transfer: false,
      },
    ],
    data_handling_requirements: ["references_over_payloads"],
    deadline: null,
    readiness_status: "needs_input",
    confirmed_by_user: false,
    idempotency_key: overrides.idempotency_key ?? newIdempotencyKey(),
    created_at: now,
    updated_at: now,
    ...overrides,
  };
}

function sampleMission(intake: IntakeMissionBundle): MissionObject {
  return {
    mission_id: `MIS-${intake.intake_id.replace(/^INT-/, "")}`,
    object_version: "1.0",
    revision: 1,
    source_intake_id: intake.intake_id,
    source_intake_version: intake.intake_version,
    mapping_version: "1.0",
    status: "ready",
    planning_status: "not_started",
    planning_revision: 0,
    last_planned_at: null,
    planning_reason: null,
    criticality: "normal",
    subtask_ids: [],
    current_blockers: [],
    approval_policy_refs: ["AIPOS-GOV-001"],
    anticipated_approval_points: ["user_confirmation"],
    evidence_refs: [`intake:${intake.intake_id}`],
    title: intake.mission_summary,
    mission_summary: intake.mission_summary,
    desired_outcome: intake.desired_outcome,
    success_criteria: intake.success_criteria,
    constraints: intake.constraints,
    deadline: null,
    operational_risk: intake.operational_risk,
    sensitivity_flags: intake.sensitivity_flags,
  };
}

function sampleNotionSync(
  missionId: string,
  overrides: Partial<NotionSyncRecord> = {},
): NotionSyncRecord {
  const now = nowIso();
  return {
    mission_id: missionId,
    notion_page_id: null,
    sync_status: "mock_synced",
    sync_attempt_id: "SYNC-TEST0001",
    verified_by: "operator:test",
    verified_at: now,
    verification_method: "user_confirm_mapping",
    verification_version: "1.0",
    source_record_version: "1",
    policy_decision_id: "MAP-TEST",
    last_error: null,
    synced_at: now,
    updated_at: now,
    ...overrides,
  };
}

function defineRepositoryContract(
  label: "dev-file" | "postgres",
  opts: {
    create: () => Promise<Repository>;
    reset: () => Promise<void>;
    cleanup?: () => Promise<void>;
    enabled?: boolean;
  },
) {
  const suite = opts.enabled === false ? describe.skip : describe;

  suite(`Repository contract (${label})`, () => {
    afterEach(async () => {
      await opts.reset();
    });

    afterAll(async () => {
      await opts.cleanup?.();
    });

    it("creates and updates an intake", async () => {
      const repo = await opts.create();
      const bundle = sampleIntake();
      await repo.saveIntake(bundle);
      const loaded = await repo.getIntakeById(bundle.intake_id);
      expect(loaded?.intake_id).toBe(bundle.intake_id);
      expect(loaded?.raw_request).toBe(bundle.raw_request);

      const updated = {
        ...bundle,
        readiness_status: "awaiting_confirmation" as const,
        updated_at: nowIso(),
      };
      await repo.saveIntake(updated);
      const again = await repo.getIntakeById(bundle.intake_id);
      expect(again?.readiness_status).toBe("awaiting_confirmation");
    });

    it("looks up intake by idempotency_key", async () => {
      const repo = await opts.create();
      const key = "IDEM-CONTRACT-1";
      const bundle = sampleIntake({ idempotency_key: key });
      await repo.saveIntake(bundle);
      const found = await repo.getIntakeByIdempotencyKey(key);
      expect(found?.intake_id).toBe(bundle.intake_id);
    });

    it("maps mission idempotently by intake id + version", async () => {
      const repo = await opts.create();
      const intake = sampleIntake({
        readiness_status: "ready_to_dispatch",
        confirmed_by_user: true,
      });
      await repo.saveIntake(intake);
      const mission = sampleMission(intake);
      await repo.saveMission(mission);

      const byVersion = await repo.getMissionByIntakeIdAndVersion(
        intake.intake_id,
        intake.intake_version,
      );
      expect(byVersion?.mission_id).toBe(mission.mission_id);

      await repo.saveMission({ ...mission, revision: 1 });
      const again = await repo.getMissionByIntakeIdAndVersion(
        intake.intake_id,
        intake.intake_version,
      );
      expect(again?.mission_id).toBe(mission.mission_id);
      const all = (await repo.listMissions()).filter(
        (m) =>
          m.source_intake_id === intake.intake_id &&
          m.source_intake_version === intake.intake_version,
      );
      expect(all).toHaveLength(1);
    });

    it("appends and reads audit events", async () => {
      const repo = await opts.create();
      const intake = sampleIntake();
      await repo.saveIntake(intake);
      const eventId = newAuditId();
      await repo.appendAudit({
        id: eventId,
        aggregate_type: "intake",
        mission_id: null,
        intake_id: intake.intake_id,
        actor: "operator:test",
        action: "intake:create",
        reason: "contract test",
        correlation_id: newCorrelationId(),
        causation_id: null,
        previous_state: null,
        new_state: "needs_input",
        policy_result: { decision: "allow" },
        created_at: nowIso(),
      });
      const events = await repo.listAudit({ intake_id: intake.intake_id });
      expect(events.some((e) => e.id === eventId)).toBe(true);
      expect(events[0]?.action).toBe("intake:create");
    });

    it("writes notion sync state and stores verification invalidation", async () => {
      const repo = await opts.create();
      const intake = sampleIntake({
        readiness_status: "ready_to_dispatch",
        confirmed_by_user: true,
      });
      await repo.saveIntake(intake);
      const mission = sampleMission(intake);
      await repo.saveMission(mission);

      const sync = sampleNotionSync(mission.mission_id, {
        source_record_version: "1",
        sync_status: "mock_synced",
      });
      await repo.saveNotionSync(sync);
      const loaded = await repo.getNotionSync(mission.mission_id);
      expect(loaded?.sync_status).toBe("mock_synced");
      expect(loaded?.verified_by).toBe("operator:test");
      expect(loaded?.source_record_version).toBe("1");

      // Service-layer invalidation persists this shape when source version changes.
      const invalidated = sampleNotionSync(mission.mission_id, {
        sync_status: "pending",
        verified_by: null,
        verified_at: null,
        verification_method: null,
        verification_version: null,
        source_record_version: "2",
        synced_at: null,
        notion_page_id: null,
      });
      await repo.saveNotionSync(invalidated);
      const after = await repo.getNotionSync(mission.mission_id);
      expect(after?.sync_status).toBe("pending");
      expect(after?.verified_by).toBeNull();
      expect(after?.source_record_version).toBe("2");
    });

    it("lists seeded policies and capabilities", async () => {
      const repo = await opts.create();
      const pols = await repo.listPolicies();
      const caps = await repo.listCapabilities();
      expect(pols.length).toBeGreaterThan(0);
      expect(caps.length).toBeGreaterThan(0);
      expect(repo.adapterName).toBe(label);
    });
  });
}

defineRepositoryContract("dev-file", {
  create: async () => {
    await fs.rm(tmpRoot, { recursive: true, force: true });
    return new DevFileRepository(tmpRoot);
  },
  reset: async () => {
    await fs.rm(tmpRoot, { recursive: true, force: true });
  },
});

async function ensurePgSchema(url: string) {
  const sqlPath = path.resolve(process.cwd(), "drizzle/0000_init.sql");
  const ddl = await fs.readFile(sqlPath, "utf8");
  const sql = postgres(url, { max: 1, prepare: false, onnotice: () => {} });
  try {
    await sql.unsafe(ddl);
  } finally {
    await sql.end({ timeout: 5 });
  }
}

defineRepositoryContract("postgres", {
  enabled: Boolean(pgUrl),
  create: async () => {
    if (!pgUrl) throw new Error("AIPOS_TEST_DATABASE_URL required");
    process.env.DATABASE_URL = pgUrl;
    await ensurePgSchema(pgUrl);
    await closeDb();
    return new PostgresRepository();
  },
  reset: async () => {
    if (!pgUrl) return;
    const sql = postgres(pgUrl, { max: 1, prepare: false, onnotice: () => {} });
    try {
      await sql.unsafe(`
        TRUNCATE TABLE
          audit_events,
          notion_sync,
          missions,
          intakes
        RESTART IDENTITY CASCADE;
      `);
    } finally {
      await sql.end({ timeout: 5 });
    }
    await closeDb();
  },
  cleanup: async () => {
    await closeDb();
  },
});
