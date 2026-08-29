import { afterEach, describe, expect, it } from "vitest";
import path from "path";
import { promises as fs } from "fs";
import { DevFileRepository } from "@/lib/repositories/dev-file-store";
import { analyzeIntake, confirmIntake, createIntake } from "@/lib/services/intake-service";
import { runControlPlanePipeline } from "@/lib/services/control-plane-pipeline";

const tmpRoot = path.join(process.cwd(), ".data-test-cp-pipeline");

afterEach(async () => {
  globalThis.__aiposRepo = undefined;
  (globalThis as { __aiposLinearMock?: unknown }).__aiposLinearMock = undefined;
  await fs.rm(tmpRoot, { recursive: true, force: true });
});

describe("control plane pipeline", () => {
  it("runs mission through dispatch verify integrate health via Linear mock", async () => {
    globalThis.__aiposRepo = new DevFileRepository(tmpRoot);
    globalThis.__aiposPersistenceMode = "dev-file";
    process.env.NOTION_ADAPTER = "mock";
    process.env.NOTION_MOCK_SUCCESS = "true";
    process.env.LINEAR_ADAPTER = "mock";

    const { bundle } = await createIntake(
      {
        raw_request: "Implement a small TypeScript helper with measurable success criteria",
        idempotency_key: "IDEM-PIPE-1",
      },
      "operator:test",
    );
    await analyzeIntake(bundle.intake_id, "operator:test");
    const confirmed = await confirmIntake(
      bundle.intake_id,
      { reason: "confirm", sensitivity_acknowledged: true },
      "operator:test",
    );
    expect(confirmed.ok).toBe(true);
    if (!confirmed.ok) return;

    const result = await runControlPlanePipeline({
      missionId: confirmed.mission_id,
      actor: "operator:test",
      blueprintApproved: true,
    });

    expect(result.routing.output).toBe("ROUTED");
    expect(result.dispatch.blocked).toHaveLength(0);
    expect(result.dispatch.dispatched.length).toBeGreaterThan(0);
    expect(result.assignments.length).toBeGreaterThan(0);
    expect(result.verifications.every((v) => v.status === "PASS")).toBe(true);
    expect(result.integration.final_status).toBe("READY_FOR_OWNER_REVIEW");
    expect(["HEALTHY", "WARNING", "BLOCKED", "CRITICAL"]).toContain(result.health.status);
    expect(result.state.workstreams.length).toBeGreaterThan(0);
    expect(result.state.handoffs.length).toBeGreaterThan(0);
  });

  it("fails closed before dispatch without explicit Blueprint approval", async () => {
    globalThis.__aiposRepo = new DevFileRepository(tmpRoot);
    globalThis.__aiposPersistenceMode = "dev-file";
    process.env.NOTION_ADAPTER = "mock";
    process.env.NOTION_MOCK_SUCCESS = "true";
    process.env.LINEAR_ADAPTER = "mock";

    const { bundle } = await createIntake(
      {
        raw_request: "Implement a small TypeScript helper with measurable success criteria",
        idempotency_key: "IDEM-PIPE-BLUEPRINT-GATE",
      },
      "operator:test",
    );
    await analyzeIntake(bundle.intake_id, "operator:test");
    const confirmed = await confirmIntake(
      bundle.intake_id,
      { reason: "confirm intake only", sensitivity_acknowledged: true },
      "operator:test",
    );
    expect(confirmed.ok).toBe(true);
    if (!confirmed.ok) return;

    await expect(
      runControlPlanePipeline({
        missionId: confirmed.mission_id,
        actor: "operator:test",
      }),
    ).rejects.toThrow("BLUEPRINT_APPROVAL_REQUIRED");
  });
});
