import { afterEach, describe, expect, it } from "vitest";
import path from "path";
import { promises as fs } from "fs";
import { DevFileRepository } from "@/lib/repositories/dev-file-store";
import { analyzeIntake, confirmIntake, createIntake } from "@/lib/services/intake-service";
import { initializeMissionControlState } from "@/lib/services/aipos-supervisor";
import { applyHumanGate } from "@/lib/services/human-gate";
import { getMissionControlState } from "@/lib/services/control-plane-state";

const tmpRoot = path.join(process.cwd(), ".data-test-human-gate");

afterEach(async () => {
  globalThis.__aiposRepo = undefined;
  await fs.rm(tmpRoot, { recursive: true, force: true });
});

describe("human gate policy", () => {
  it("auto authorizes low-risk and blocks high-impact by owner gate", async () => {
    globalThis.__aiposRepo = new DevFileRepository(tmpRoot);
    globalThis.__aiposPersistenceMode = "dev-file";
    process.env.NOTION_MOCK_SUCCESS = "true";

    const { bundle } = await createIntake(
      { raw_request: "Draft internal mission summary", idempotency_key: "IDEM-HG-1" },
      "operator:test",
    );
    await analyzeIntake(bundle.intake_id, "operator:test");
    const confirmed = await confirmIntake(bundle.intake_id, { reason: "confirm" }, "operator:test");
    expect(confirmed.ok).toBe(true);
    if (!confirmed.ok) return;
    await initializeMissionControlState(confirmed.mission_id);

    const low = await applyHumanGate({
      missionId: confirmed.mission_id,
      action: "draft internal note",
      risk_level: "L1",
      reversible: true,
      delegated: true,
    });
    expect(low.authorized).toBe(true);

    const high = await applyHumanGate({
      missionId: confirmed.mission_id,
      action: "publish production announcement",
      risk_level: "L4",
      reversible: false,
      delegated: false,
    });
    expect(high.authorized).toBe(false);
    expect(high.requires_human).toBe(true);

    const state = await getMissionControlState(confirmed.mission_id);
    expect(state.mission_state).toBe("WAITING_HUMAN");
    expect(state.blockers.some((row) => row.code === "HUMAN_GATE_REQUIRED")).toBe(true);
  });
});
