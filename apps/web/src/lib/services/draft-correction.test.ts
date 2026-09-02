import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { DevFileRepository } from "@/lib/repositories/dev-file-store";
import { correctChatDraft, handleChatTurn, resumeChatIntake } from "./chat-intake-service";
import { cancelIntake } from "./intake-service";
import { DraftCorrectionSchema } from "@/lib/schemas/draft-correction";
import { mapBundleToMission } from "./mapping-service";

let dir: string;
let repo: DevFileRepository;
beforeEach(async () => {
  dir = await mkdtemp(path.join(tmpdir(), "aipos-correction-"));
  repo = new DevFileRepository(dir);
  globalThis.__aiposRepo = repo;
  globalThis.__aiposPersistenceMode = "dev-file";
});
afterEach(async () => {
  globalThis.__aiposRepo = undefined;
  vi.restoreAllMocks();
  await rm(dir, { recursive: true, force: true });
});

async function fixture() {
  const turn = await handleChatTurn(
    {
      message: "ภารกิจทดสอบ Linear E2E ไม่มีข้อมูลส่วนบุคคล ห้าม deploy",
      idempotency_key: "correction-test",
    },
    "operator:test",
  );
  const b = turn.bundle!;
  return {
    b,
    patch: {
      intake_id: b.intake_id,
      expected_updated_at: b.updated_at,
      mission_summary: "Linear E2E หนึ่งงาน",
      desired_outcome: "สร้างและอ่านกลับหนึ่ง Issue โดยไม่ซ้ำ",
      success_criteria: ["อ่าน Issue ID เดิมกลับได้", "รันซ้ำไม่สร้างเพิ่ม"],
      constraints: ["ข้อมูลสมมติเท่านั้น", "ห้าม deploy", "ยังไม่ dispatch"],
      workstreams: [
        {
          id: b.draft_workstreams[0].id,
          name: "ทดสอบ Linear หนึ่งงาน",
          purpose: "ตรวจ readback และ dedupe",
          expected_outputs: ["Issue ID และ readback evidence"],
        },
      ],
    },
  };
}

describe("Existing draft correction — AC product #2 / Architecture Contract §§4,6", () => {
  it("requires fresh acknowledgment when a correction introduces a new sensitivity flag", async () => {
    const { b, patch } = await fixture();
    await repo.saveIntake({ ...b, sensitivity_acknowledged: true });
    const result = await correctChatDraft(
      { ...patch, desired_outcome: "Review a password credential" },
      "operator:test",
    );
    expect(result.bundle?.sensitivity_flags).toContain("credentials");
    expect(result.bundle?.sensitivity_acknowledged).toBe(false);
    expect(result.clarifications.some((c) => c.code === "ACKNOWLEDGE_SENSITIVITY")).toBe(true);
    expect(result.bundle?.operational_risk).toBe(b.operational_risk);
  });
  it("edits one persisted intake without creating a mission, relaxing gates or changing identity", async () => {
    const { b, patch } = await fixture();
    const result = await correctChatDraft(patch, "operator:test");
    const saved = await repo.getIntakeById(b.intake_id);
    expect((await repo.listIntakes()).length).toBe(1);
    expect(await repo.listMissions()).toHaveLength(0);
    expect(saved?.idempotency_key).toBe(b.idempotency_key);
    expect(saved?.raw_request).toBe(b.raw_request);
    expect(saved?.confirmed_by_user).toBe(false);
    expect(saved?.operational_risk).toBe(b.operational_risk);
    expect(saved?.sensitivity_flags).toEqual(b.sensitivity_flags);
    expect(saved?.sensitivity_acknowledged).toBe(b.sensitivity_acknowledged);
    expect(saved?.approval_requirements).toEqual(b.approval_requirements);
    expect(saved?.draft_workstreams).toHaveLength(1);
    expect(saved?.draft_workstreams[0].approval_points).toEqual([
      ...new Set(b.draft_workstreams.flatMap((w) => w.approval_points)),
    ]);
    expect(saved?.constraints).toEqual(patch.constraints);
    expect(result.conversation_state).toBe("needs_clarification");
    expect(mapBundleToMission(saved!).planning_input.draft_workstreams).toHaveLength(1);
    const resumed = await resumeChatIntake(b.intake_id);
    expect(resumed.draft?.mission_summary).toBe(patch.mission_summary);
  });
  it("rejects stale retries without duplicating audit or intakes", async () => {
    const { b, patch } = await fixture();
    await correctChatDraft(patch, "operator:test");
    const save = vi.spyOn(repo, "saveIntake");
    await expect(
      correctChatDraft({ ...patch, expected_updated_at: "stale" }, "operator:test"),
    ).rejects.toThrow("INTAKE_STALE");
    expect(save).not.toHaveBeenCalled();
    expect((await repo.getIntakeById(b.intake_id))?.mission_summary).toBe(patch.mission_summary);
  });
  it("resumes read-only and fails closed for unknown IDs", async () => {
    const { b } = await fixture();
    const save = vi.spyOn(repo, "saveIntake");
    await resumeChatIntake(b.intake_id);
    await expect(resumeChatIntake("INT-MISSING")).rejects.toThrow("INTAKE_NOT_FOUND");
    expect(save).not.toHaveBeenCalled();
  });
  it("rejects cancelled and confirmed drafts", async () => {
    const { b, patch } = await fixture();
    await cancelIntake(b.intake_id, "operator:test", "test cancellation");
    await expect(correctChatDraft(patch, "operator:test")).rejects.toThrow("INTAKE_CANCELLED");
    await repo.saveIntake({ ...b, confirmed_by_user: true });
    await expect(correctChatDraft(patch, "operator:test")).rejects.toThrow(
      "INTAKE_ALREADY_CONFIRMED",
    );
  });
  it("rejects unknown workstream IDs", async () => {
    const { patch } = await fixture();
    await expect(
      correctChatDraft(
        { ...patch, workstreams: [{ ...patch.workstreams[0], id: "WS-NOT-EXIST" }] },
        "operator:test",
      ),
    ).rejects.toThrow("INTAKE_WORKSTREAM_UNKNOWN");
  });
  it("rejects authority injection, empty criteria and duplicate workstream IDs", async () => {
    const { patch } = await fixture();
    for (const extra of [
      { operational_risk: "L0" },
      { sensitivity_acknowledged: true },
      { confirmed_by_user: true },
      { capability_families: ["verified"] },
    ]) {
      expect(DraftCorrectionSchema.safeParse({ ...patch, ...extra }).success).toBe(false);
    }
    expect(DraftCorrectionSchema.safeParse({ ...patch, success_criteria: [" "] }).success).toBe(
      false,
    );
    expect(
      DraftCorrectionSchema.safeParse({
        ...patch,
        workstreams: [patch.workstreams[0], patch.workstreams[0]],
      }).success,
    ).toBe(false);
  });
});
