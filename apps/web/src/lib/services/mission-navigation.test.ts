import { afterEach, describe, expect, it } from "vitest";
import path from "path";
import { promises as fs } from "fs";
import { DevFileRepository } from "@/lib/repositories/dev-file-store";
import { analyzeIntake, confirmIntake, createIntake } from "@/lib/services/intake-service";
import {
  checkpointActiveMission,
  evaluateStaleMissionNavigation,
  interruptMission,
  resolveInterruption,
  resumeMission,
  setPrimaryMission,
} from "@/lib/services/mission-navigation";

const tmpRoot = path.join(process.cwd(), ".data-test-mission-navigation");

afterEach(async () => {
  globalThis.__aiposRepo = undefined;
  await fs.rm(tmpRoot, { recursive: true, force: true });
});

async function seedMission(key: string, request: string) {
  const { bundle } = await createIntake(
    { raw_request: request, idempotency_key: key },
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

async function seedNavigation() {
  globalThis.__aiposRepo = new DevFileRepository(tmpRoot);
  globalThis.__aiposPersistenceMode = "dev-file";
  process.env.NOTION_ADAPTER = "mock";
  process.env.NOTION_MOCK_SUCCESS = "true";
  const primary = await seedMission(
    "IDEM-NAV-PRIMARY",
    "Build a staged mission dashboard with measurable acceptance criteria",
  );
  const interruption = await seedMission(
    "IDEM-NAV-INT",
    "Implement a small TypeScript helper with measurable success criteria",
  );
  await setPrimaryMission({
    workspaceId: "owner:nitis",
    missionId: primary,
    objective: "Complete persistent mission navigation",
    definitionOfDone: "Interruption returns idempotently to the saved checkpoint",
    nextAction: "Implement checkpoint runtime",
    actor: "operator:test",
  });
  return { primary, interruption };
}

// prettier-ignore
describe("Persistent Mission Navigation", () => {
  it("stores checkpoints idempotently and resumes one executable action", async () => {
    await seedNavigation();
    const first = await checkpointActiveMission({
      workspaceId: "owner:nitis",
      summary: "Checkpoint after schema",
      completedOutputs: ["mission-navigation.v1"],
      nextAction: "Implement interruption stack",
      blockers: [],
      idempotencyKey: "checkpoint-schema-complete",
      actor: "operator:test",
    });
    const retry = await checkpointActiveMission({
      workspaceId: "owner:nitis",
      summary: "Duplicate retry must not create work",
      completedOutputs: [],
      nextAction: "wrong duplicate action",
      blockers: [],
      idempotencyKey: "checkpoint-schema-complete",
      actor: "operator:test",
    });

    expect(retry.revision).toBe(first.revision);
    expect((await resumeMission("owner:nitis")).next_action).toBe(
      "Implement interruption stack",
    );
  });

  it("pushes an interruption and automatically returns to the prior checkpoint", async () => {
    const { primary, interruption } = await seedNavigation();
    await checkpointActiveMission({
      workspaceId: "owner:nitis",
      summary: "Primary work safely checkpointed",
      completedOutputs: ["checkpoint service"],
      nextAction: "Add stale supervisor",
      blockers: [],
      idempotencyKey: "before-interruption",
      actor: "operator:test",
    });
    const interrupted = await interruptMission({
      workspaceId: "owner:nitis",
      interruptionMissionId: interruption,
      classification: "URGENT_INTERRUPTION",
      reason: "Urgent bounded verification",
      interruptionNextAction: "Verify urgent issue",
      actor: "operator:test",
    });
    expect(interrupted.active_mission_id).toBe(interruption);
    expect(interrupted.interruption_stack).toHaveLength(1);

    const resolved = await resolveInterruption({
      workspaceId: "owner:nitis",
      result: "COMPLETED",
      summary: "Urgent verification complete",
      actor: "operator:test",
    });
    expect(resolved.state.active_mission_id).toBe(primary);
    expect(resolved.state.interruption_stack).toHaveLength(0);
    expect(resolved.return_prompt.next_action).toBe("Add stale supervisor");
  });

  it("reports a focused stale reminder without mutating state", async () => {
    await seedNavigation();
    const state = await checkpointActiveMission({
      workspaceId: "owner:nitis",
      summary: "Waiting safely",
      completedOutputs: [],
      nextAction: "Resume the primary mission",
      blockers: [],
      idempotencyKey: "stale-check",
      actor: "operator:test",
    });
    const stale = evaluateStaleMissionNavigation(
      { ...state, updated_at: "2026-08-28T00:00:00.000Z" },
      new Date("2026-08-30T00:00:00.000Z"),
      24,
    );

    expect(stale.stale).toBe(true);
    expect(stale.reminder).toContain("Resume");
    expect(stale.reminder).toContain("Resume the primary mission");
  });
});
