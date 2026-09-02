import { afterEach, describe, expect, it } from "vitest";
import path from "path";
import { promises as fs } from "fs";
import { DevFileRepository } from "@/lib/repositories/dev-file-store";
import { analyzeIntake, confirmIntake, createIntake } from "@/lib/services/intake-service";
import {
  approveMaterialScopeChange,
  calculateMissionForecast,
  registerScopeItem,
} from "@/lib/services/scope-guard";

const tmpRoot = path.join(process.cwd(), ".data-test-scope-guard");

afterEach(async () => {
  globalThis.__aiposRepo = undefined;
  await fs.rm(tmpRoot, { recursive: true, force: true });
});

async function seedMission() {
  globalThis.__aiposRepo = new DevFileRepository(tmpRoot);
  globalThis.__aiposPersistenceMode = "dev-file";
  process.env.NOTION_ADAPTER = "mock";
  process.env.NOTION_MOCK_SUCCESS = "true";
  const { bundle } = await createIntake(
    {
      raw_request: "Build a staged mission dashboard with measurable acceptance criteria",
      idempotency_key: "IDEM-SCOPE-GUARD",
    },
    "operator:test",
  );
  await analyzeIntake(bundle.intake_id, "operator:test");
  const confirmed = await confirmIntake(
    bundle.intake_id,
    { reason: "confirm", sensitivity_acknowledged: true },
    "operator:test",
  );
  if (!confirmed.ok) throw new Error("confirm failed");
  return confirmed.mission_id;
}

function noImpact() {
  return { time: false, cost: false, risk: false, architecture: false, detail: null };
}

// prettier-ignore
describe("Scope Guard and WIP Control", () => {
  it("rejects MUST_NOW when it is not required for DoD or safety", async () => {
    const missionId = await seedMission();
    await expect(
      registerScopeItem({
        missionId,
        title: "Nice dashboard animation",
        description: "Add animation unrelated to mission acceptance",
        classification: "MUST_NOW",
        required_for_dod: false,
        safety_required: false,
        rationale: "Looks useful",
        value: "Cosmetic",
        material_impact: noImpact(),
        actor: "operator:test",
      }),
    ).rejects.toThrow("MUST_NOW_REQUIRES_DOD_OR_SAFETY");
  });

  it("enforces finish-before-expand WIP limit", async () => {
    const missionId = await seedMission();
    await registerScopeItem({
      missionId,
      title: "Required acceptance test",
      description: "Test required by Definition of Done",
      classification: "MUST_NOW",
      required_for_dod: true,
      safety_required: false,
      rationale: "Required for accepted outcome",
      value: "Evidence",
      material_impact: noImpact(),
      wip_limit: 1,
      actor: "operator:test",
    });
    await expect(
      registerScopeItem({
        missionId,
        title: "Second required change",
        description: "Another required change competing for active WIP",
        classification: "MUST_NOW",
        required_for_dod: true,
        safety_required: false,
        rationale: "Required but must wait for capacity",
        value: "Completion",
        material_impact: noImpact(),
        wip_limit: 1,
        actor: "operator:test",
      }),
    ).rejects.toThrow("WIP_LIMIT_REACHED");
  });

  it("parks material scope change until explicit tradeoff approval", async () => {
    const missionId = await seedMission();
    const item = await registerScopeItem({
      missionId,
      title: "Change persistence architecture",
      description: "Material architecture expansion required by revised DoD",
      classification: "MUST_NOW",
      required_for_dod: true,
      safety_required: false,
      rationale: "Revised acceptance requires durable state",
      value: "Durability",
      material_impact: {
        time: true,
        cost: false,
        risk: true,
        architecture: true,
        detail: "Adds two days and migration risk",
      },
      actor: "operator:test",
    });
    expect(item.status).toBe("PARKED");
    expect(item.approval_status).toBe("REQUIRED");

    const approved = await approveMaterialScopeChange({
      missionId,
      scopeItemId: item.scope_item_id,
      tradeoff: "Defer optional UI polish to preserve deadline",
      actor: "operator:test",
    });
    expect(approved.status).toBe("ACTIVE");
    expect(approved.approval_status).toBe("APPROVED");
  });

  it("produces a range forecast with explicit assumptions", () => {
    const forecast = calculateMissionForecast({
      missionId: "MIS-FORECAST",
      stages: [
        { stage_id: "STAGE-1", min_hours: 2, max_hours: 4, assumption: "No schema migration" },
        { stage_id: "STAGE-2", min_hours: 3, max_hours: 6, assumption: "CI remains available" },
      ],
    });
    expect(forecast.min_effort_hours).toBe(5);
    expect(forecast.max_effort_hours).toBe(10);
    expect(forecast.assumptions).toHaveLength(2);
  });
});
