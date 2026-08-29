import { afterEach, describe, expect, it } from "vitest";
import path from "path";
import { promises as fs } from "fs";
import { DevFileRepository } from "@/lib/repositories/dev-file-store";
import { analyzeIntake, confirmIntake, createIntake } from "@/lib/services/intake-service";
import { saveMissionBlueprint } from "@/lib/services/mission-blueprint";
import {
  compareStageArtifactSnapshots,
  listStageArtifactSnapshots,
  rollbackStageArtifact,
  saveStageArtifactSnapshot,
} from "@/lib/services/stage-artifact";
import { getMissionControlState } from "@/lib/services/control-plane-state";

const tmpRoot = path.join(process.cwd(), ".data-test-stage-artifact");

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
      raw_request: "Produce a verified document artifact with immutable revisions",
      idempotency_key: "IDEM-STAGE-ARTIFACT-1",
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
  await saveMissionBlueprint({
    missionId: confirmed.mission_id,
    actor: "operator:test",
    final_outcome: "Verified document artifact",
    definition_of_done: "Final render passes QA",
    stages: [
      {
        stage_id: "STAGE-1",
        order: 1,
        title: "Produce document",
        objective: "Create and verify final document",
        outputs: ["Editable document", "Final PDF", "Preview"],
        dependencies: [],
        entry_criteria: ["Blueprint approved"],
        exit_criteria: ["Render QA passes"],
        owner: "worker:documents",
        status: "PLANNED",
        evidence_refs: [],
      },
    ],
    critical_path: ["STAGE-1"],
    next_action: "Create draft artifact",
  });
  return confirmed.mission_id;
}

function qaEvidence() {
  return ["render_integrity", "content_completeness"].map((check) => ({
    check,
    status: "PASS" as const,
    evidence_ref: `evidence:${check}`,
    verified_at: "2026-08-29T00:00:00.000Z",
    verified_by: "verifier:test",
  }));
}

// prettier-ignore
describe("Stage Artifact Pipeline", () => {
  it("preserves draft/final snapshots and projects the final artifact into mission state", async () => {
    const missionId = await seedMission();
    await saveStageArtifactSnapshot({
      missionId,
      stageId: "STAGE-1",
      actor: "operator:test",
      status: "DRAFT",
      kind: "document",
      editable_uri: "artifact://editable/r1",
      checksum: "sha256:draft",
      qa_evidence: [],
    });
    const final = await saveStageArtifactSnapshot({
      missionId,
      stageId: "STAGE-1",
      actor: "operator:test",
      status: "FINAL",
      kind: "document",
      editable_uri: "artifact://editable/r2",
      final_uri: "artifact://final/r2.pdf",
      preview_uri: "artifact://preview/r2.png",
      checksum: "sha256:final",
      qa_evidence: qaEvidence(),
    });

    expect(final.revision).toBe(2);
    expect(final.parent_revision).toBe(1);
    expect(await listStageArtifactSnapshots(missionId, "STAGE-1")).toHaveLength(2);
    expect((await getMissionControlState(missionId)).artifacts[0]?.uri).toBe(
      "artifact://final/r2.pdf",
    );
  });

  it("refuses final promotion without render playbook evidence", async () => {
    const missionId = await seedMission();
    await expect(
      saveStageArtifactSnapshot({
        missionId,
        stageId: "STAGE-1",
        actor: "operator:test",
        status: "FINAL",
        kind: "document",
        editable_uri: "artifact://editable/r1",
        final_uri: "artifact://final/r1.pdf",
        preview_uri: "artifact://preview/r1.png",
        checksum: "sha256:invalid",
        qa_evidence: [],
      }),
    ).rejects.toThrow("ARTIFACT_QA_EVIDENCE_INCOMPLETE");
  });

  it("rolls back by creating a new immutable revision and exposes a comparison", async () => {
    const missionId = await seedMission();
    const first = await saveStageArtifactSnapshot({
      missionId,
      stageId: "STAGE-1",
      actor: "operator:test",
      status: "FINAL",
      kind: "document",
      editable_uri: "artifact://editable/r1",
      final_uri: "artifact://final/r1.pdf",
      preview_uri: "artifact://preview/r1.png",
      checksum: "sha256:first",
      qa_evidence: qaEvidence(),
    });
    const second = await saveStageArtifactSnapshot({
      missionId,
      stageId: "STAGE-1",
      actor: "operator:test",
      status: "FINAL",
      kind: "document",
      editable_uri: "artifact://editable/r2",
      final_uri: "artifact://final/r2.pdf",
      preview_uri: "artifact://preview/r2.png",
      checksum: "sha256:second",
      qa_evidence: qaEvidence(),
    });
    const rolledBack = await rollbackStageArtifact({
      missionId,
      stageId: "STAGE-1",
      targetRevision: first.revision,
      actor: "operator:test",
    });

    expect(rolledBack.revision).toBe(3);
    expect(rolledBack.rollback_of_revision).toBe(1);
    expect(rolledBack.final_uri).toBe(first.final_uri);
    expect(compareStageArtifactSnapshots(first, second).map((row) => row.field)).toContain(
      "checksum",
    );
  });
});
