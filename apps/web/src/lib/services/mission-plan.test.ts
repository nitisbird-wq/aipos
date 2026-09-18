/**
 * Mission Plan + Owner Plan Review — Comprehensive Test Suite
 *
 * Covers:
 * 1. Plan generation — decomposer produces rich 17-field workstreams
 * 2. Playbook coverage — all 9 playbook types produce non-generic plans
 * 3. Owner questions — 10 questions generated per plan
 * 4. Per-workstream approval — PROPOSED → APPROVED → DISPATCHABLE state machine
 * 5. Approve all — batch approval transitions all workstreams
 * 6. Edit workstream — patch resets approval_state to PROPOSED
 * 7. Remove workstream — removes cleanly; guards last workstream
 * 8. Add workstream — custom workstream appended and starts PROPOSED
 * 9. Dispatch protection — unapproved workstreams blocked at dispatch gate
 * 10. Regenerate — produces fresh plan overwriting existing
 * 11. Answer owner question — answer saved on plan
 * 12. Plan persistence — round-trip through MissionControlState
 */

import { afterEach, beforeEach, describe, expect, it } from "vitest";
import path from "path";
import { promises as fs } from "fs";
import { DevFileRepository } from "@/lib/repositories/dev-file-store";
import { createIntake, analyzeIntake, confirmIntake } from "@/lib/services/intake-service";
import { initializeMissionControlState } from "@/lib/services/aipos-supervisor";
import { getMissionControlState } from "@/lib/services/control-plane-state";
import {
  generateMissionPlan,
  getPlanReviewState,
  approvePlanWorkstream,
  editPlanWorkstream,
  removePlanWorkstream,
  addPlanWorkstream,
  approveAllPlan,
  answerOwnerQuestion,
  regeneratePlan,
  dispatchableWorkstreams,
} from "@/lib/services/mission-plan";
import { decomposeMissionStrategy } from "@/lib/services/decomposer";
import { dispatchWorkstreams } from "@/lib/services/workstream-dispatcher";
import { buildMissionContextPack, buildMissionStrategy } from "@/lib/services/mission-strategist";
import { analyzeMissionHeuristic } from "@/lib/services/analyze";
import { nowIso } from "@/lib/ids";

const tmpRoot = path.join(process.cwd(), ".data-test-mission-plan");

beforeEach(() => {
  globalThis.__aiposRepo = new DevFileRepository(tmpRoot);
  globalThis.__aiposPersistenceMode = "dev-file";
  process.env.NOTION_ADAPTER = "mock";
  process.env.NOTION_MOCK_SUCCESS = "true";
  process.env.LINEAR_ADAPTER = "mock";
  process.env.N8N_ADAPTER = "mock";
});

afterEach(async () => {
  globalThis.__aiposRepo = undefined;
  (globalThis as { __aiposLinearMock?: unknown }).__aiposLinearMock = undefined;
  try {
    await fs.rm(tmpRoot, { recursive: true, force: true });
  } catch {
    // best-effort cleanup; ignore directory-still-in-use races
  }
});

async function seedMission(raw_request: string, key: string): Promise<{ missionId: string }> {
  const { bundle } = await createIntake({ raw_request, idempotency_key: key }, "operator:test");
  await analyzeIntake(bundle.intake_id, "operator:test");
  const confirmed = await confirmIntake(
    bundle.intake_id,
    { reason: "plan test", sensitivity_acknowledged: true },
    "operator:test",
  );
  if (!confirmed.ok) throw new Error("seedMission: confirm failed");
  await initializeMissionControlState(confirmed.mission_id);
  return { missionId: confirmed.mission_id };
}

function makeStrategy(missionId: string, topic: string) {
  const analysis = analyzeMissionHeuristic(topic);
  const contextPack = buildMissionContextPack({
    missionId,
    actor: "operator:test",
    context: [
      {
        id: `CTX-${missionId}`,
        context_class: "LIVE",
        domain: "mission",
        type: "mission_summary",
        statement: topic,
        source: "app_db",
        provenance: `mission:${missionId}`,
        status: "REPORTED",
        version: "1.0",
        effective_at: nowIso(),
        freshness: "fresh",
        review_due: nowIso(),
        confidence: 0.85,
        evidence: [],
        owner: "operator:test",
        sensitivity: "internal",
        access: "need_to_know",
        supersedes: [],
        conflicts_with: [],
      },
    ],
  });
  return buildMissionStrategy({ missionId, analysis, contextPack });
}

// --- 1. Plan generation ---
describe("1. generateMissionPlan — 17-field workstream", () => {
  it("produces workstreams with approval_state=PROPOSED and owner_notes=''", async () => {
    const { missionId } = await seedMission(
      "Research competitive landscape for SaaS pricing",
      "PLAN-GEN-001",
    );
    const strategy = makeStrategy(missionId, "Research competitive landscape for SaaS pricing");
    const plan = await generateMissionPlan({ missionId, strategy, actor: "operator:test" });

    expect(plan.workstreams.length).toBeGreaterThanOrEqual(1);
    for (const ws of plan.workstreams) {
      // 17 required fields
      expect(ws.workstream_id).toBeTruthy();
      expect(ws.mission_id).toBe(missionId);
      expect(ws.title).toBeTruthy();
      expect(ws.objective).toBeTruthy();
      expect(ws.reason_required).toBeTruthy();
      expect(ws.inputs).toBeDefined();
      expect(ws.expected_output.length).toBeGreaterThan(0);
      expect(ws.acceptance_criteria.length).toBeGreaterThan(0);
      expect(ws.dependencies).toBeDefined();
      expect(ws.required_capabilities.length).toBeGreaterThan(0);
      expect(ws.risk_level).toMatch(/^L[0-4]$/);
      expect(typeof ws.approval_required).toBe("boolean");
      expect(typeof ws.parallelizable).toBe("boolean");
      expect(ws.execution_order).toBeGreaterThanOrEqual(1);
      expect(ws.status).toBeTruthy();
      // new fields (16, 17)
      expect(ws.approval_state).toBe("PROPOSED");
      expect(ws.owner_notes).toBe("");
    }
  });

  it("stores plan_review in MissionControlState", async () => {
    const { missionId } = await seedMission("Build new feature for dashboard", "PLAN-GEN-002");
    const strategy = makeStrategy(missionId, "Build new feature for dashboard");
    await generateMissionPlan({ missionId, strategy, actor: "operator:test" });

    const state = await getMissionControlState(missionId);
    expect(state.plan_review).toBeDefined();
    expect(state.plan_review?.mission_id).toBe(missionId);
    expect(state.plan_review?.review_status).toBe("PENDING_REVIEW");
  });
});

// --- 2. Playbook coverage ---
describe("2. Playbook coverage — all playbooks produce non-generic workstreams", () => {
  const PLAYBOOK_TOPICS: [string, string][] = [
    ["research", "competitor research survey literature"],
    ["debug", "bug in production: login page crash"],
    ["software_build", "implement new checkout feature build"],
    ["automation", "automate weekly n8n workflow recurring"],
    ["decision", "executive decision brief recommend option"],
    ["knowledge_organization", "organize notion knowledge taxonomy"],
    ["business_launch", "launch product pricing go-to-market"],
    ["creative_synthesis", "design creative visual brand prototype concept"],
    ["investigation", "investigate anomaly in metrics"],
  ];

  for (const [playbook, topic] of PLAYBOOK_TOPICS) {
    it(`${playbook} playbook produces workstreams with non-generic titles`, () => {
      const missionId = `PLAY-${playbook.toUpperCase()}-DIRECT`;
      const strategy = makeStrategy(missionId, topic);
      expect(strategy.selected_playbook).toBe(playbook);
      const workstreams = decomposeMissionStrategy(strategy);
      expect(workstreams.length).toBeGreaterThan(0);
      for (const ws of workstreams) {
        expect(ws.title.toLowerCase()).not.toMatch(
          /^(understand scope|do main work|create output|produce final deliverable|understand & scope|produce primary deliverable)$/,
        );
      }
    });
  }
});

// --- 3. Owner questions ---
describe("3. Owner questions — 10 questions per plan", () => {
  it("generates exactly 10 owner questions", async () => {
    const { missionId } = await seedMission("research competitive products", "PLAN-Q-001");
    const strategy = makeStrategy(missionId, "research competitive products");
    const plan = await generateMissionPlan({ missionId, strategy, actor: "operator:test" });
    expect(plan.owner_questions.length).toBe(10);
  });

  it("questions have required flags and null answers initially", async () => {
    const { missionId } = await seedMission("build authentication feature", "PLAN-Q-002");
    const strategy = makeStrategy(missionId, "build authentication feature");
    const plan = await generateMissionPlan({ missionId, strategy, actor: "operator:test" });
    for (const q of plan.owner_questions) {
      expect(q.id).toBeTruthy();
      expect(q.question).toBeTruthy();
      expect(typeof q.required).toBe("boolean");
      expect(q.answer).toBeNull();
    }
    const requiredCount = plan.owner_questions.filter((q) => q.required).length;
    expect(requiredCount).toBeGreaterThan(0);
  });
});

// --- 4. Per-workstream approval ---
describe("4. Per-workstream approval state machine", () => {
  it("PROPOSED → APPROVED on single workstream approve", async () => {
    const { missionId } = await seedMission("research market sizing data", "PLAN-APPROVE-001");
    const strategy = makeStrategy(missionId, "research market sizing data");
    const plan = await generateMissionPlan({ missionId, strategy, actor: "operator:test" });
    const firstWsId = plan.workstreams[0]!.workstream_id;

    const updated = await approvePlanWorkstream(missionId, firstWsId, "operator:test");
    const ws = updated.workstreams.find((w) => w.workstream_id === firstWsId)!;
    expect(ws.approval_state).toBe("APPROVED");
  });

  it("all approved → DISPATCHABLE transition fires", async () => {
    const { missionId } = await seedMission("debug authentication bug", "PLAN-APPROVE-002");
    const strategy = makeStrategy(missionId, "debug authentication bug");
    const plan = await generateMissionPlan({ missionId, strategy, actor: "operator:test" });

    let current = plan;
    for (const ws of plan.workstreams) {
      current = await approvePlanWorkstream(missionId, ws.workstream_id, "operator:test");
    }
    for (const ws of current.workstreams) {
      expect(ws.approval_state).toBe("DISPATCHABLE");
    }
    expect(current.review_status).toBe("APPROVED");
  });

  it("partial approval does not transition any to DISPATCHABLE", async () => {
    const { missionId } = await seedMission(
      "build software feature implementation",
      "PLAN-APPROVE-003",
    );
    const strategy = makeStrategy(missionId, "build software feature implementation");
    const plan = await generateMissionPlan({ missionId, strategy, actor: "operator:test" });
    if (plan.workstreams.length < 2) return;

    const firstWsId = plan.workstreams[0]!.workstream_id;
    const updated = await approvePlanWorkstream(missionId, firstWsId, "operator:test");
    const proposed = updated.workstreams.filter((ws) => ws.approval_state === "PROPOSED");
    expect(proposed.length).toBeGreaterThan(0);
    const dispatchable = updated.workstreams.filter((ws) => ws.approval_state === "DISPATCHABLE");
    expect(dispatchable.length).toBe(0);
  });

  it("idempotent: approving already-APPROVED workstream keeps state", async () => {
    const { missionId } = await seedMission("investigate performance anomaly", "PLAN-APPROVE-004");
    const strategy = makeStrategy(missionId, "investigate performance anomaly");
    const plan = await generateMissionPlan({ missionId, strategy, actor: "operator:test" });
    const wsId = plan.workstreams[0]!.workstream_id;

    const first = await approvePlanWorkstream(missionId, wsId, "operator:test");
    const ws1 = first.workstreams.find((w) => w.workstream_id === wsId)!;

    const second = await approvePlanWorkstream(missionId, wsId, "operator:test");
    const ws2 = second.workstreams.find((w) => w.workstream_id === wsId)!;
    expect(ws2.approval_state).toBe(ws1.approval_state);
  });
});

// --- 5. Approve all ---
describe("5. Approve all", () => {
  it("approveAllPlan transitions every workstream to DISPATCHABLE", async () => {
    const { missionId } = await seedMission("research AI tools landscape", "PLAN-APPALL-001");
    const strategy = makeStrategy(missionId, "research AI tools landscape");
    await generateMissionPlan({ missionId, strategy, actor: "operator:test" });

    const result = await approveAllPlan(missionId, "operator:test");
    for (const ws of result.workstreams) {
      expect(ws.approval_state).toBe("DISPATCHABLE");
    }
    expect(result.review_status).toBe("APPROVED");
  });
});

// --- 6. Edit workstream ---
describe("6. Edit workstream", () => {
  it("patch updates fields and resets approval_state to PROPOSED", async () => {
    const { missionId } = await seedMission("build notification system", "PLAN-EDIT-001");
    const strategy = makeStrategy(missionId, "build notification system");
    const plan = await generateMissionPlan({ missionId, strategy, actor: "operator:test" });
    const wsId = plan.workstreams[0]!.workstream_id;

    await approvePlanWorkstream(missionId, wsId, "operator:test");
    const edited = await editPlanWorkstream(
      missionId,
      wsId,
      {
        title: "Updated: Build notification system with retry",
        owner_notes: "Must support email and Slack",
      },
      "operator:test",
    );
    const ws = edited.workstreams.find((w) => w.workstream_id === wsId)!;
    expect(ws.title).toBe("Updated: Build notification system with retry");
    expect(ws.owner_notes).toBe("Must support email and Slack");
    expect(ws.approval_state).toBe("PROPOSED");
  });
});

// --- 7. Remove workstream ---
describe("7. Remove workstream", () => {
  it("removes a workstream from the plan", async () => {
    const { missionId } = await seedMission("build payment integration feature", "PLAN-REM-001");
    const strategy = makeStrategy(missionId, "build payment integration feature");
    const plan = await generateMissionPlan({ missionId, strategy, actor: "operator:test" });
    if (plan.workstreams.length < 2) return;

    const removeId = plan.workstreams[plan.workstreams.length - 1]!.workstream_id;
    const updated = await removePlanWorkstream(missionId, removeId, "operator:test");
    expect(updated.workstreams.find((w) => w.workstream_id === removeId)).toBeUndefined();
    expect(updated.workstreams.length).toBe(plan.workstreams.length - 1);
  });

  it("throws CANNOT_REMOVE_LAST_WORKSTREAM when only one remains", async () => {
    const { missionId } = await seedMission("debug crash on login page", "PLAN-REM-002");
    const strategy = makeStrategy(missionId, "debug crash on login page");
    const plan = await generateMissionPlan({ missionId, strategy, actor: "operator:test" });
    for (const ws of plan.workstreams.slice(0, -1)) {
      await removePlanWorkstream(missionId, ws.workstream_id, "operator:test");
    }
    const lastPlan = await getPlanReviewState(missionId);
    expect(lastPlan!.workstreams.length).toBe(1);
    await expect(
      removePlanWorkstream(missionId, lastPlan!.workstreams[0]!.workstream_id, "operator:test"),
    ).rejects.toThrow("CANNOT_REMOVE_LAST_WORKSTREAM");
  });
});

// --- 8. Add workstream ---
describe("8. Add workstream", () => {
  it("custom workstream is appended and starts as PROPOSED", async () => {
    const { missionId } = await seedMission("research analytics tools and pricing", "PLAN-ADD-001");
    const strategy = makeStrategy(missionId, "research analytics tools and pricing");
    const plan = await generateMissionPlan({ missionId, strategy, actor: "operator:test" });

    const updated = await addPlanWorkstream(
      missionId,
      {
        title: "Stakeholder review session",
        objective: "Present findings to stakeholders and capture feedback",
        reason_required: "Owner approval on direction before implementation",
        expected_output: ["feedback_notes", "approved_direction"],
        acceptance_criteria: ["All stakeholders have reviewed", "Direction approved"],
        required_capabilities: ["research", "documentation"],
        risk_level: "L1",
        approval_required: true,
      },
      "operator:test",
    );
    const added = updated.workstreams[updated.workstreams.length - 1]!;
    expect(added.title).toBe("Stakeholder review session");
    expect(added.approval_state).toBe("PROPOSED");
    expect(updated.workstreams.length).toBe(plan.workstreams.length + 1);
  });
});

// --- 9. Dispatch protection ---
describe("9. Dispatch protection — unapproved workstreams blocked", () => {
  it("workstreams with approval_state=PROPOSED are blocked at dispatch gate", async () => {
    const { missionId } = await seedMission("investigate anomaly in server logs", "PLAN-DISP-001");
    const strategy = makeStrategy(missionId, "investigate anomaly in server logs");
    const plan = await generateMissionPlan({ missionId, strategy, actor: "operator:test" });

    const result = await dispatchWorkstreams({
      missionId,
      workstreams: plan.workstreams,
      adapter: {
        searchByCorrelationId: async () => null,
        createWorkstreamIssue: async ({ correlationId, title }) => ({
          id: `LIN-${correlationId}`,
          title,
        }),
      },
      actor: "operator:test",
    });

    expect(result.blocked.length).toBe(plan.workstreams.length);
    expect(result.dispatched.length).toBe(0);
    for (const b of result.blocked) {
      expect(b.reason).toContain("WORKSTREAM_NOT_APPROVED");
    }
  });

  it("DISPATCHABLE workstreams are dispatched successfully", async () => {
    const { missionId } = await seedMission("build logging service feature", "PLAN-DISP-002");
    const strategy = makeStrategy(missionId, "build logging service feature");
    await generateMissionPlan({ missionId, strategy, actor: "operator:test" });
    const approvedPlan = await approveAllPlan(missionId, "operator:test");
    const toDispatch = dispatchableWorkstreams(approvedPlan);

    expect(toDispatch.length).toBeGreaterThan(0);

    const result = await dispatchWorkstreams({
      missionId,
      workstreams: toDispatch,
      adapter: {
        searchByCorrelationId: async () => null,
        createWorkstreamIssue: async ({ correlationId, title }) => ({
          id: `LIN-${correlationId}`,
          title,
        }),
      },
      actor: "operator:test",
    });

    expect(result.dispatched.length).toBe(toDispatch.length);
    expect(result.blocked.filter((b) => b.reason.includes("WORKSTREAM_NOT_APPROVED")).length).toBe(
      0,
    );
  });
});

// --- 10. Regenerate ---
describe("10. Regenerate plan", () => {
  it("overwrites the existing plan with a fresh one", async () => {
    const { missionId } = await seedMission("investigate database latency spike", "PLAN-REGEN-001");
    const strategy = makeStrategy(missionId, "investigate database latency spike");
    const original = await generateMissionPlan({ missionId, strategy, actor: "operator:test" });
    await approveAllPlan(missionId, "operator:test");

    const regenerated = await regeneratePlan({ missionId, strategy, actor: "operator:test" });
    expect(regenerated.plan_id).toBe(original.plan_id);
    for (const ws of regenerated.workstreams) {
      expect(ws.approval_state).toBe("PROPOSED");
    }
    expect(regenerated.review_status).toBe("PENDING_REVIEW");
  });
});

// --- 11. Answer owner question ---
describe("11. Answer owner question", () => {
  it("saves answer on the correct question", async () => {
    const { missionId } = await seedMission("research pricing strategies", "PLAN-ANS-001");
    const strategy = makeStrategy(missionId, "research pricing strategies");
    const plan = await generateMissionPlan({ missionId, strategy, actor: "operator:test" });
    const q = plan.owner_questions[0]!;

    const updated = await answerOwnerQuestion(
      missionId,
      q.id,
      "Revenue growth is primary KPI",
      "operator:test",
    );
    const answered = updated.owner_questions.find((oq) => oq.id === q.id)!;
    expect(answered.answer).toBe("Revenue growth is primary KPI");
  });
});

// --- 12. Plan persistence ---
describe("12. Plan persistence — round-trip through MissionControlState", () => {
  it("plan survives round-trip through getMissionControlState", async () => {
    const { missionId } = await seedMission("build feature X integration", "PLAN-PERSIST-001");
    const strategy = makeStrategy(missionId, "build feature X integration");
    await generateMissionPlan({ missionId, strategy, actor: "operator:test" });
    await approveAllPlan(missionId, "operator:test");

    const retrieved = await getPlanReviewState(missionId);
    expect(retrieved).not.toBeNull();
    expect(retrieved!.review_status).toBe("APPROVED");
    for (const ws of retrieved!.workstreams) {
      expect(ws.approval_state).toBe("DISPATCHABLE");
    }
  });

  it("getPlanReviewState returns null when no plan exists", async () => {
    const { missionId } = await seedMission("simple inquiry about weather", "PLAN-NULL-001");
    const plan = await getPlanReviewState(missionId);
    expect(plan).toBeNull();
  });
});

// --- 13. Thai Research+Recommendation regression ---
const THAI_RESEARCH_MISSION =
  "หาความรู้และแนะนำเกมพัฒนาเชาวน์ที่เหมาะกับลูก พร้อมหลักฐาน เหตุผล ข้อดีข้อเสีย และแผนการนำไปใช้จริง";

describe("13. Thai Research+Recommendation mission regression", () => {
  it("routes Thai mission to 'research' playbook, not 'code' or 'knowledge_organization'", () => {
    const analysis = analyzeMissionHeuristic(THAI_RESEARCH_MISSION);
    expect(analysis.capability_families).toContain("research");
    expect(analysis.capability_families).not.toContain("code");
    expect(analysis.capability_families).not.toContain("knowledge_management");
  });

  it("strategy selects 'research' playbook for Thai mission", () => {
    const missionId = "THAI-REGRESSION-001";
    const strategy = makeStrategy(missionId, THAI_RESEARCH_MISSION);
    expect(strategy.selected_playbook).toBe("research");
  });

  it("research decomposition produces ≥6 workstreams for Thai mission", () => {
    const missionId = "THAI-REGRESSION-002";
    const strategy = makeStrategy(missionId, THAI_RESEARCH_MISSION);
    const workstreams = decomposeMissionStrategy(strategy);
    expect(workstreams.length).toBeGreaterThanOrEqual(6);
  });

  it("all research workstreams have rich plan detail fields populated", () => {
    const missionId = "THAI-REGRESSION-003";
    const strategy = makeStrategy(missionId, THAI_RESEARCH_MISSION);
    const workstreams = decomposeMissionStrategy(strategy);
    for (const ws of workstreams) {
      expect(ws.proposed_actions?.length ?? 0).toBeGreaterThan(0);
      expect(ws.execution_steps?.length ?? 0).toBeGreaterThan(0);
      expect(ws.proposed_worker).toBeTruthy();
      expect(ws.proposed_tools?.length ?? 0).toBeGreaterThan(0);
      expect(ws.evidence_requirements?.length ?? 0).toBeGreaterThan(0);
      expect(ws.recovery_strategy).toBeTruthy();
    }
  });

  it("dependency integrity is maintained after removePlanWorkstream", async () => {
    const { missionId } = await seedMission(THAI_RESEARCH_MISSION, "THAI-REGRESSION-004");
    const strategy = makeStrategy(missionId, THAI_RESEARCH_MISSION);
    const plan = await generateMissionPlan({ missionId, strategy, actor: "operator:test" });

    // WS2 depends on WS1; remove WS1 — WS2 deps should be cleaned up
    const ws1 = plan.workstreams.find((ws) => ws.execution_order === 1)!;
    const ws2 = plan.workstreams.find((ws) => ws.execution_order === 2)!;
    expect(ws2.dependencies).toContain(ws1.workstream_id);

    const updated = await removePlanWorkstream(missionId, ws1.workstream_id, "operator:test");
    const updatedWs2 = updated.workstreams.find((ws) => ws.workstream_id === ws2.workstream_id)!;
    expect(updatedWs2.dependencies).not.toContain(ws1.workstream_id);
  });

  it("research plan requires WS6 human gate before dispatch", () => {
    const missionId = "THAI-REGRESSION-005";
    const strategy = makeStrategy(missionId, THAI_RESEARCH_MISSION);
    const workstreams = decomposeMissionStrategy(strategy);
    const ws6 = workstreams.find((ws) => ws.execution_order === 6);
    expect(ws6).toBeDefined();
    expect(ws6?.human_gate_required).toBe(true);
    expect(ws6?.authority_level).toBe("L2");
  });
});
