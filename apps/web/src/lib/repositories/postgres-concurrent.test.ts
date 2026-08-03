import { afterEach, beforeEach, describe, expect, it } from "vitest";
import path from "path";
import { promises as fs } from "fs";
import postgres from "postgres";
import { closeDb } from "@/lib/db/client";
import { analyzeIntake, confirmIntake, createIntake } from "@/lib/services/intake-service";
import { getRepository } from "@/lib/repositories";

const pgUrl =
  process.env.AIPOS_TEST_DATABASE_URL?.trim() ||
  (process.env.AIPOS_RUN_PG_TESTS === "true" ? process.env.DATABASE_URL?.trim() : undefined);

describe.runIf(Boolean(pgUrl))("PostgreSQL concurrent confirm hardening", () => {
  beforeEach(async () => {
    if (!pgUrl) return;
    process.env.DATABASE_URL = pgUrl;
    process.env.FORCE_POSTGRES = "true";
    process.env.NOTION_ADAPTER = "mock";
    process.env.NOTION_MOCK_SUCCESS = "true";
    globalThis.__aiposRepo = undefined;
    globalThis.__aiposPersistenceMode = undefined;
    await closeDb();

    const sqlPath = path.resolve(process.cwd(), "drizzle");
    const files = (await fs.readdir(sqlPath)).filter((f) => f.endsWith(".sql")).sort();
    const sql = postgres(pgUrl, { max: 1, prepare: false, onnotice: () => {} });
    try {
      for (const file of files) {
        const ddl = await fs.readFile(path.join(sqlPath, file), "utf8");
        await sql.unsafe(ddl);
      }
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

  it("concurrent confirm returns one mission, one mapping audit, one notion_sync row", async () => {
    const { bundle } = await createIntake(
      {
        raw_request: "Draft a research synthesis without secrets for concurrent confirm",
        idempotency_key: "IDEM-CONCURRENT-CONFIRM-1",
      },
      "operator:test",
    );
    await analyzeIntake(bundle.intake_id, "operator:test");

    const results = await Promise.all([
      confirmIntake(
        bundle.intake_id,
        { sensitivity_acknowledged: true, reason: "confirm-a" },
        "operator:test",
      ),
      confirmIntake(
        bundle.intake_id,
        { sensitivity_acknowledged: true, reason: "confirm-b" },
        "operator:test",
      ),
      confirmIntake(
        bundle.intake_id,
        { sensitivity_acknowledged: true, reason: "confirm-c" },
        "operator:test",
      ),
    ]);

    expect(results.every((r) => r.ok)).toBe(true);
    const missionIds = results
      .filter((r): r is Extract<typeof r, { ok: true }> => r.ok)
      .map((r) => r.mission_id);
    expect(new Set(missionIds).size).toBe(1);

    const repo = getRepository();
    const missions = (await repo.listMissions()).filter(
      (m) =>
        m.source_intake_id === bundle.intake_id &&
        m.source_intake_version === bundle.intake_version,
    );
    expect(missions).toHaveLength(1);

    const audits = await repo.listAudit({ mission_id: missionIds[0] });
    const mappingAccepts = audits.filter((a) => a.action === "mapping:accept");
    expect(mappingAccepts).toHaveLength(1);

    const sync = await repo.getNotionSync(missionIds[0]!);
    expect(sync).not.toBeNull();
  });

  it("concurrent createIntake with same idempotency_key returns one intake", async () => {
    const key = "IDEM-CONCURRENT-CREATE-1";
    const results = await Promise.all([
      createIntake({ raw_request: "One shared intake A", idempotency_key: key }, "operator:test"),
      createIntake({ raw_request: "One shared intake B", idempotency_key: key }, "operator:test"),
      createIntake({ raw_request: "One shared intake C", idempotency_key: key }, "operator:test"),
    ]);
    const ids = results.map((r) => r.bundle.intake_id);
    expect(new Set(ids).size).toBe(1);
    expect(results.some((r) => r.reused)).toBe(true);

    const repo = getRepository();
    const all = (await repo.listIntakes()).filter((i) => i.idempotency_key === key);
    expect(all).toHaveLength(1);
  });
});
