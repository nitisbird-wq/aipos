import { afterEach, describe, expect, it } from "vitest";
import path from "path";
import { promises as fs } from "fs";
import { DevFileRepository } from "@/lib/repositories/dev-file-store";
import { analyzeIntake, confirmIntake, createIntake } from "@/lib/services/intake-service";
import {
  approveMissionBlueprint,
  computeBlueprintProgress,
  getApprovedMissionBlueprint,
  getLatestMissionBlueprint,
  saveMissionBlueprint,
} from "@/lib/services/mission-blueprint";
import type { MissionStage } from "@/lib/schemas/mission-blueprint";

const tmpRoot = path.join(process.cwd(), ".data-test-mission-blueprint");

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
      idempotency_key: "IDEM-BLUEPRINT-1",
    },
    "operator:test",
  );
  await analyzeIntake(bundle.intake_id, "operator:test");
  const confirmed = await confirmIntake(
    bundle.intake_id,
    { reason: "confirm intake", sensitivity_acknowledged: true },
    "operator:test",
  );
  expect(confirmed.ok).toBe(true);
  if (!confirmed.ok) throw new Error("confirm failed");
  return confirmed.mission_id;
}

function stages(firstStatus: MissionStage["status"] = "PLANNED"): MissionStage[] {
  return [
    {
      stage_id: "STAGE-1",
      order: 1,
      title: "Define Blueprint",
      objective: "Lock the outcome and stage contract",
      outputs: ["Approved Blueprint"],
      dependencies: [],
      entry_criteria: ["Mission exists"],
      exit_criteria: ["Owner approval recorded"],
      owner: "aipos",
      status: firstStatus,
      evidence_refs: firstStatus === "COMPLETED" ? ["evidence:blueprint-approved"] : [],
    },
    {
      stage_id: "STAGE-2",
      order: 2,
      title: "Execute Mission",
      objective: "Produce and verify the approved outcome",
      outputs: ["Verified deliverable"],
      dependencies: ["STAGE-1"],
      entry_criteria: ["STAGE-1 completed"],
      exit_criteria: ["Definition of Done passes"],
      owner: "worker",
      status: "PLANNED",
      evidence_refs: [],
    },
  ];
}

describe("Mission Blueprint revisions and approval", () => {
  it("creates an editable revision, records approval, and exposes evidence progress", async () => {
    const missionId = await seedMission();
    const draft = await saveMissionBlueprint({
      missionId,
      actor: "operator:test",
      final_outcome: "Owner can see and approve the complete mission path",
      definition_of_done: "Both stages pass with evidence",
      stages: stages("COMPLETED"),
      critical_path: ["STAGE-1", "STAGE-2"],
      next_action: "Review Blueprint",
    });

    expect(draft.revision).toBe(1);
    expect(draft.status).toBe("IN_REVIEW");
    expect(draft.progress).toMatchObject({
      completed_stages: 1,
      total_stages: 2,
      percent: 50,
    });

    const approved = await approveMissionBlueprint({
      missionId,
      revision: 1,
      actor: "operator:test",
    });
    expect(approved.status).toBe("APPROVED");
    expect(approved.approved_by).toBe("operator:test");
    expect((await getApprovedMissionBlueprint(missionId))?.revision).toBe(1);
  });

  it("versions edits and refuses stale approval", async () => {
    const missionId = await seedMission();
    await saveMissionBlueprint({
      missionId,
      actor: "operator:test",
      final_outcome: "Initial outcome",
      definition_of_done: "Initial DoD",
      stages: stages(),
      critical_path: ["STAGE-1", "STAGE-2"],
      next_action: "Revise",
    });
    const revised = await saveMissionBlueprint({
      missionId,
      actor: "operator:test",
      final_outcome: "Revised outcome",
      definition_of_done: "Revised DoD",
      stages: stages(),
      critical_path: ["STAGE-1", "STAGE-2"],
      next_action: "Approve revision 2",
    });

    expect(revised.revision).toBe(2);
    expect(revised.supersedes_revision).toBe(1);
    expect((await getLatestMissionBlueprint(missionId))?.final_outcome).toBe("Revised outcome");
    await expect(
      approveMissionBlueprint({ missionId, revision: 1, actor: "operator:test" }),
    ).rejects.toThrow("STALE_BLUEPRINT_REVISION");
  });

  it("does not count a completed stage without evidence", () => {
    const invalid = stages("COMPLETED");
    invalid[0]!.evidence_refs = [];
    expect(() => computeBlueprintProgress(invalid)).toThrow(
      "COMPLETED_STAGE_REQUIRES_EVIDENCE",
    );
  });
});
