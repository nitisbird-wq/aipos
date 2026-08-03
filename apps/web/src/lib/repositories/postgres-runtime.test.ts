import { afterEach, beforeEach, describe, expect, it } from "vitest";
import path from "path";
import { promises as fs } from "fs";
import postgres from "postgres";
import { closeDb } from "@/lib/db/client";
import { analyzeIntake, confirmIntake, createIntake } from "@/lib/services/intake-service";
import { getPersistenceMode, getRepository } from "@/lib/repositories";
import { missionIdFromIntake } from "@/lib/ids";

const pgUrl =
  process.env.AIPOS_TEST_DATABASE_URL?.trim() ||
  (process.env.AIPOS_RUN_PG_TESTS === "true" ? process.env.DATABASE_URL?.trim() : undefined);

const fileTmp = path.join(process.cwd(), ".data-test-factory");

describe("getRepository factory", () => {
  afterEach(async () => {
    globalThis.__aiposRepo = undefined;
    globalThis.__aiposPersistenceMode = undefined;
    await closeDb();
    delete process.env.FORCE_POSTGRES;
    await fs.rm(fileTmp, { recursive: true, force: true });
  });

  it("defaults to dev-file when DATABASE_URL is unset", async () => {
    const prev = process.env.DATABASE_URL;
    delete process.env.DATABASE_URL;
    process.env.FORCE_POSTGRES = "false";
    // Ensure fresh factory
    globalThis.__aiposRepo = undefined;
    const { DevFileRepository } = await import("@/lib/repositories/dev-file-store");
    // Inject file repo with tmp path so we don't touch real .data
    const repo = new DevFileRepository(fileTmp);
    globalThis.__aiposRepo = repo;
    globalThis.__aiposPersistenceMode = "dev-file";
    expect(getRepository().adapterName).toBe("dev-file");
    expect(getPersistenceMode()).toBe("dev-file");
    if (prev !== undefined) process.env.DATABASE_URL = prev;
  });
});

describe.runIf(Boolean(pgUrl))("PostgreSQL runtime confirm flow", () => {
  beforeEach(async () => {
    if (!pgUrl) return;
    process.env.DATABASE_URL = pgUrl;
    process.env.FORCE_POSTGRES = "true";
    process.env.NOTION_ADAPTER = "mock";
    process.env.NOTION_MOCK_SUCCESS = "true";
    globalThis.__aiposRepo = undefined;
    globalThis.__aiposPersistenceMode = undefined;
    await closeDb();

    const sqlPath = path.resolve(process.cwd(), "drizzle/0000_init.sql");
    const ddl = await fs.readFile(sqlPath, "utf8");
    const sql = postgres(pgUrl, { max: 1, prepare: false, onnotice: () => {} });
    try {
      await sql.unsafe(ddl);
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
  });

  afterEach(async () => {
    globalThis.__aiposRepo = undefined;
    globalThis.__aiposPersistenceMode = undefined;
    await closeDb();
    delete process.env.FORCE_POSTGRES;
  });

  it("FORCE_POSTGRES selects postgres adapter and confirm is idempotent with audit + sync", async () => {
    const repo = getRepository();
    expect(repo.adapterName).toBe("postgres");
    expect(getPersistenceMode()).toBe("postgres");

    const { bundle } = await createIntake(
      {
        raw_request: "Draft a research synthesis without secrets",
        idempotency_key: "IDEM-PG-FLOW-1",
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
    expect(first.mission_id).toBe(missionIdFromIntake(bundle.intake_id, bundle.intake_version));

    const second = await confirmIntake(
      bundle.intake_id,
      { sensitivity_acknowledged: true, reason: "confirm again" },
      "operator:test",
    );
    expect(second.ok).toBe(true);
    if (!second.ok) return;
    expect(second.mission_id).toBe(first.mission_id);
    expect(second.reused).toBe(true);

    const missions = await repo.listMissions();
    expect(missions.filter((m) => m.mission_id === first.mission_id)).toHaveLength(1);

    const audits = await repo.listAudit({ mission_id: first.mission_id });
    expect(audits.length).toBeGreaterThan(0);

    const sync = await repo.getNotionSync(first.mission_id);
    expect(sync).not.toBeNull();
    expect(["mock_synced", "synced", "pending", "failed"]).toContain(sync!.sync_status);
  });
});
