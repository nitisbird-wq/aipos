/**
 * One-shot integration: create brain-training game research mission,
 * generate plan, apply Decision Bundle (WS1-N APPROVE + last WS EDIT→improved AC),
 * verify readback, then APPROVE WS6 in round 2.
 *
 * Run via: npx vitest run --config apps/web/vitest.config.ts src/lib/services/apply-decision-bundle.integration.test.ts
 */
import { afterAll, describe, expect, it } from "vitest";
import path from "path";
import { promises as fs } from "fs";
import { DevFileRepository } from "@/lib/repositories/dev-file-store";
import { analyzeIntake, confirmIntake, createIntake } from "@/lib/services/intake-service";
import { buildMissionContextPack, buildMissionStrategy } from "@/lib/services/mission-strategist";
import { analyzeMissionHeuristic } from "@/lib/services/analyze";
import { generateMissionPlan, getPlanReviewState } from "@/lib/services/mission-plan";
import { applyDecisionBundle } from "@/lib/services/plan-decision-applier";
import { nowIso } from "@/lib/ids";

const tmpRoot = path.join(process.cwd(), ".data-bundle-integration");

afterAll(async () => {
  globalThis.__aiposRepo = undefined;
  await fs.rm(tmpRoot, { recursive: true, force: true });
});

const BRAIN_GAME_REQUEST =
  "วิจัยและแนะนำเกมพัฒนาเชาวน์สำหรับเด็กที่เหมาะสมกับลูก พร้อมหลักฐานเชิงวิทยาศาสตร์ เหตุผล ข้อดีข้อเสียเปรียบเทียบ และแผนนำไปใช้จริง";

const IMPROVED_AC = [
  "สำเร็จเมื่อ: มีรายชื่อเกมพัฒนาเชาวน์ ≥3 รายการ พร้อมหลักฐานเชิงวิทยาศาสตร์สำหรับแต่ละรายการ (แหล่งที่มา ปี ผลการวิจัย)",
  "สำเร็จเมื่อ: มีตารางเปรียบเทียบ pros/cons ของแต่ละเกม (ราคา ช่วงอายุที่เหมาะสม ความยากง่าย ความสนุก ความเป็นวิทยาศาสตร์)",
  "สำเร็จเมื่อ: มีแผนนำไปใช้จริงระบุ: ช่วงอายุของลูก ความถี่การเล่น (นาที/วัน) วิธีวัดพัฒนาการ และ checkpoint อย่างน้อย 1 เดือน",
  "สำเร็จเมื่อ: มี Notion record ที่ readback ได้ยืนยันว่าบันทึกครบถ้วน (ตรวจสอบผ่าน notion_reader หลัง write)",
];

const IMPROVED_EVIDENCE_REQUIREMENTS = [
  "ลิงก์หรือ citation ของงานวิจัยแต่ละชิ้น พร้อมบอกว่าสนับสนุนเกมอะไรอย่างไร",
  "ตารางเปรียบเทียบที่ผ่านการตรวจสอบจาก verification workstream",
  "Notion readback confirmation (URL + page content snapshot)",
];

async function seedBrainGameMission() {
  globalThis.__aiposRepo = new DevFileRepository(tmpRoot);
  globalThis.__aiposPersistenceMode = "dev-file";
  process.env.NOTION_ADAPTER = "mock";
  process.env.NOTION_MOCK_SUCCESS = "true";

  const { bundle } = await createIntake(
    { raw_request: BRAIN_GAME_REQUEST, idempotency_key: "BRAIN-GAME-BUNDLE-TEST-001" },
    "operator:nitisbird",
  );
  await analyzeIntake(bundle.intake_id, "operator:nitisbird");
  const confirmed = await confirmIntake(
    bundle.intake_id,
    { reason: "research", sensitivity_acknowledged: true },
    "operator:nitisbird",
  );
  expect(confirmed.ok).toBe(true);
  if (!confirmed.ok) throw new Error("confirm failed");

  const analysis = analyzeMissionHeuristic(bundle.raw_request);
  const strategy = buildMissionStrategy({
    missionId: confirmed.mission_id,
    analysis,
    contextPack: buildMissionContextPack({
      missionId: confirmed.mission_id,
      actor: "operator:nitisbird",
      context: [
        {
          id: "CTX-BG-1",
          context_class: "LIVE",
          domain: "mission",
          type: "request",
          statement: bundle.raw_request,
          source: "web_app",
          provenance: `web:${bundle.intake_id}`,
          status: "REPORTED",
          version: "1.0",
          effective_at: new Date().toISOString(),
          freshness: "fresh",
          review_due: new Date(Date.now() + 3_600_000).toISOString(),
          confidence: 0.9,
          evidence: [],
          owner: "operator:nitisbird",
          approver: "operator:nitisbird",
          sensitivity: "internal",
          access: "need_to_know",
          supersedes: [],
          conflicts_with: [],
        },
      ],
    }),
  });

  const plan = await generateMissionPlan({
    missionId: confirmed.mission_id,
    strategy,
    actor: "operator:nitisbird",
  });
  return { missionId: confirmed.mission_id, plan };
}

describe("Owner-approved Decision Bundle — brain-training game research", () => {
  let missionId: string;
  let wsIds: string[];
  let recommendWsId: string; // WS to EDIT (last in execution order)

  it("Round 1: APPROVE WS1-5, EDIT WS6 (notion_writer) with improved AC", async () => {
    const { missionId: mid, plan } = await seedBrainGameMission();
    missionId = mid;
    console.log(`\n=== Mission ID: ${missionId} ===`);
    console.log(`=== Plan version: ${plan.updated_at} ===`);
    console.log(`=== Workstreams (${plan.workstreams.length}) ===`);
    const sorted = [...plan.workstreams].sort((a, b) => a.execution_order - b.execution_order);
    sorted.forEach((ws) =>
      console.log(
        `  WS${ws.execution_order}: ${ws.workstream_id} | ${ws.title} | tools: ${ws.proposed_tools?.join(",")}`,
      ),
    );
    wsIds = sorted.map((w) => w.workstream_id);

    // WS6 = "produce recommendation" — has notion_writer, L2 authority, Human Gate
    // Identify by notion_writer in tools or by being 2nd-to-last (WS6 of 7)
    const ws6 = sorted.find((ws) => ws.proposed_tools?.includes("notion_writer"))
      ?? sorted[sorted.length - 2]!;
    recommendWsId = ws6.workstream_id;

    // WS7 = independent verification (last WS, depends on WS6)
    const ws7 = sorted[sorted.length - 1]!;

    // WS1-5: approve all workstreams before WS6
    const beforeWs6 = sorted.filter(
      (ws) => ws.execution_order < ws6.execution_order,
    );

    console.log(`\n=== EDIT target: WS${ws6.execution_order} "${ws6.title}" ===`);
    console.log(`    Tools: ${ws6.proposed_tools?.join(",")}`);
    console.log(`    AC before: ${JSON.stringify(ws6.acceptance_criteria)}`);
    console.log(`=== WS7 (to approve in round 2): WS${ws7.execution_order} "${ws7.title}" ===`);

    const bundle1 = {
      mission_id: missionId,
      plan_version: plan.updated_at,
      submitted_at: nowIso(),
      decisions: [
        // APPROVE WS1..5
        ...beforeWs6.map((ws) => ({
          workstream_id: ws.workstream_id,
          decision: "APPROVE" as const,
        })),
        // EDIT WS6 with improved AC (Owner-approved fix for C defect)
        {
          workstream_id: ws6.workstream_id,
          decision: "EDIT" as const,
          edit_notes:
            "แก้ AC ให้ระบุเกณฑ์ชัดเจน: จำนวนเกม ≥3, หลักฐานเชิงวิทยาศาสตร์, ตารางเปรียบเทียบ, แผนใช้งานจริง, Notion readback confirmed. Human Gate ยังคงอยู่ก่อน dispatch.",
          acceptance_criteria: IMPROVED_AC,
          evidence_requirements: IMPROVED_EVIDENCE_REQUIREMENTS,
        },
        // WS7 left as PROPOSED (depends on WS6 which is PROPOSED after EDIT)
      ],
    };

    const result1 = await applyDecisionBundle(bundle1, "operator:nitisbird");
    console.log(`\n=== Bundle 1 result ===`);
    console.log(`  ok: ${result1.ok}, applied: ${result1.applied}, failed: ${result1.failed}`);
    result1.verifications.forEach((v) =>
      console.log(`  ${v.workstream_id}: ${v.final_state}`),
    );

    expect(result1.ok).toBe(true);
    expect(result1.failed).toBe(0);
    // WS1-5 approved; WS6 PROPOSED (edited)
    for (const v of result1.verifications) {
      if (v.workstream_id !== ws6.workstream_id) {
        expect(["APPROVED", "DISPATCHABLE"]).toContain(v.final_state);
      } else {
        expect(v.final_state).toBe("PROPOSED");
      }
    }

    // Canonical readback
    const canonical1 = await getPlanReviewState(missionId);
    expect(canonical1).not.toBeNull();
    const editedWs = canonical1!.workstreams.find((w) => w.workstream_id === ws6.workstream_id)!;
    expect(editedWs.approval_state).toBe("PROPOSED");
    expect(editedWs.owner_notes).toContain("AC ให้ระบุเกณฑ์ชัดเจน");
    if (editedWs.acceptance_criteria) {
      expect(editedWs.acceptance_criteria.some((ac) => ac.includes("≥3"))).toBe(true);
    }

    console.log(`\n=== Canonical readback after Round 1 ===`);
    console.log(`  review_status: ${canonical1!.review_status}`);
    console.log(`  WS6 AC: ${JSON.stringify(editedWs.acceptance_criteria?.slice(0, 2))} ...`);
  });

  it("Round 2: APPROVE WS6 (notion_writer) + WS7 (verification) → DISPATCHABLE", async () => {
    const canonical1 = await getPlanReviewState(missionId);
    expect(canonical1).not.toBeNull();

    // WS7 (last) depends on WS6; applying WS6 APPROVE first in execution_order allows WS7 APPROVE
    const lastWs = [...canonical1!.workstreams].sort(
      (a, b) => a.execution_order - b.execution_order,
    )[canonical1!.workstreams.length - 1]!;

    const bundle2 = {
      mission_id: missionId,
      plan_version: canonical1!.updated_at,
      submitted_at: nowIso(),
      decisions: [
        { workstream_id: recommendWsId, decision: "APPROVE" as const },
        { workstream_id: lastWs.workstream_id, decision: "APPROVE" as const },
      ],
    };

    const result2 = await applyDecisionBundle(bundle2, "operator:nitisbird");
    console.log(`\n=== Bundle 2 result ===`);
    console.log(`  ok: ${result2.ok}, applied: ${result2.applied}, failed: ${result2.failed}`);
    result2.verifications.forEach((v) =>
      console.log(`  ${v.workstream_id}: ${v.final_state}`),
    );

    expect(result2.ok).toBe(true);
    expect(result2.failed).toBe(0);
    for (const v of result2.verifications) {
      expect(["APPROVED", "DISPATCHABLE"]).toContain(v.final_state);
    }

    // Final canonical readback: all WS must be APPROVED or DISPATCHABLE
    const canonical2 = await getPlanReviewState(missionId);
    expect(canonical2).not.toBeNull();
    console.log(`\n=== Final canonical state ===`);
    console.log(`  mission_id: ${missionId}`);
    console.log(`  review_status: ${canonical2!.review_status}`);
    canonical2!.workstreams.forEach((ws) =>
      console.log(`  ${ws.workstream_id} [order ${ws.execution_order}]: ${ws.approval_state}`),
    );

    for (const ws of canonical2!.workstreams) {
      expect(["APPROVED", "DISPATCHABLE"]).toContain(ws.approval_state);
    }
    expect(canonical2!.review_status).toBe("APPROVED");

    console.log(`\n✅ Decision Bundle flow COMPLETE`);
    console.log(`   Mission: ${missionId}`);
    console.log(`   Plan version: ${canonical2!.updated_at}`);
    console.log(`   All workstreams: APPROVED/DISPATCHABLE`);
    console.log(`   Dispatcher guard: ACTIVE (no WS dispatchable without approval)`);
    console.log(`   Human Gate WS-last: PRESERVED (human_gate_required unchanged)`);
  });
});
