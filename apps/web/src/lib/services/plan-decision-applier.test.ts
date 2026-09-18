import { afterEach, describe, expect, it } from "vitest";
import path from "path";
import { promises as fs } from "fs";
import { DevFileRepository } from "@/lib/repositories/dev-file-store";
import { analyzeIntake, confirmIntake, createIntake } from "@/lib/services/intake-service";
import { buildMissionContextPack, buildMissionStrategy } from "@/lib/services/mission-strategist";
import { analyzeMissionHeuristic } from "@/lib/services/analyze";
import { generateMissionPlan, getPlanReviewState } from "@/lib/services/mission-plan";
import { applyDecisionBundle } from "@/lib/services/plan-decision-applier";
import { nowIso } from "@/lib/ids";

const tmpRoot = path.join(process.cwd(), ".data-test-decision-applier");

afterEach(async () => {
  globalThis.__aiposRepo = undefined;
  await fs.rm(tmpRoot, { recursive: true, force: true });
});

async function seedPlan() {
  globalThis.__aiposRepo = new DevFileRepository(tmpRoot);
  globalThis.__aiposPersistenceMode = "dev-file";
  process.env.NOTION_ADAPTER = "mock";
  process.env.NOTION_MOCK_SUCCESS = "true";

  const { bundle } = await createIntake(
    {
      raw_request:
        "Build a TypeScript helper library with unit tests and publish to internal registry",
      idempotency_key: "IDEM-DA-1",
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
  if (!confirmed.ok) throw new Error("confirm failed");

  const analysis = analyzeMissionHeuristic(bundle.raw_request);
  const strategy = buildMissionStrategy({
    missionId: confirmed.mission_id,
    analysis,
    contextPack: buildMissionContextPack({
      missionId: confirmed.mission_id,
      actor: "operator:test",
      context: [
        {
          id: "CTX-DA-1",
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
          review_due: new Date(Date.now() + 3600_000).toISOString(),
          confidence: 0.9,
          evidence: [],
          owner: "operator:test",
          approver: "operator:test",
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
    actor: "operator:test",
  });
  return { missionId: confirmed.mission_id, plan };
}

describe("plan-decision-applier", () => {
  it("approves all workstreams and verifies canonical DISPATCHABLE state", async () => {
    const { missionId, plan } = await seedPlan();
    expect(plan.workstreams.length).toBeGreaterThan(0);
    expect(plan.workstreams.every((ws) => ws.approval_state === "PROPOSED")).toBe(true);

    const decisions = plan.workstreams.map((ws) => ({
      workstream_id: ws.workstream_id,
      decision: "APPROVE" as const,
    }));

    const result = await applyDecisionBundle(
      {
        mission_id: missionId,
        plan_version: plan.updated_at,
        submitted_at: nowIso(),
        decisions,
      },
      "operator:test",
    );

    expect(result.ok).toBe(true);
    expect(result.failed).toBe(0);
    expect(result.applied).toBe(plan.workstreams.length);

    // Readback: all workstreams must be APPROVED or DISPATCHABLE
    const canonical = await getPlanReviewState(missionId);
    expect(canonical).not.toBeNull();
    for (const ws of canonical!.workstreams) {
      expect(["APPROVED", "DISPATCHABLE"]).toContain(ws.approval_state);
    }
    expect(canonical!.review_status).toBe("APPROVED");
  });

  it("edits a workstream and resets it to PROPOSED", async () => {
    const { missionId, plan } = await seedPlan();
    const firstWs = plan.workstreams[0]!;

    const result = await applyDecisionBundle(
      {
        mission_id: missionId,
        plan_version: plan.updated_at,
        submitted_at: nowIso(),
        decisions: [
          {
            workstream_id: firstWs.workstream_id,
            decision: "EDIT",
            edit_notes: "Scope needs clarification before approval",
            objective: "Revised: " + firstWs.objective,
          },
        ],
      },
      "operator:test",
    );

    expect(result.ok).toBe(true);
    expect(result.verifications[0]!.final_state).toBe("PROPOSED");

    const canonical = await getPlanReviewState(missionId);
    const ws = canonical!.workstreams.find((w) => w.workstream_id === firstWs.workstream_id)!;
    expect(ws.approval_state).toBe("PROPOSED");
    expect(ws.owner_notes).toContain("Scope needs clarification");
  });

  it("reject-regenerates a workstream with rejection note", async () => {
    const { missionId, plan } = await seedPlan();
    const ws = plan.workstreams[0]!;

    const result = await applyDecisionBundle(
      {
        mission_id: missionId,
        plan_version: plan.updated_at,
        submitted_at: nowIso(),
        decisions: [
          {
            workstream_id: ws.workstream_id,
            decision: "REJECT_REGENERATE",
            edit_notes: "Approach is incorrect, regenerate with different strategy",
          },
        ],
      },
      "operator:test",
    );

    expect(result.ok).toBe(true);
    const canonical = await getPlanReviewState(missionId);
    const updated = canonical!.workstreams.find((w) => w.workstream_id === ws.workstream_id)!;
    expect(updated.approval_state).toBe("PROPOSED");
    expect(updated.owner_notes).toContain("REJECTED");
  });

  it("fails closed on stale plan_version", async () => {
    const { missionId, plan } = await seedPlan();

    await expect(
      applyDecisionBundle(
        {
          mission_id: missionId,
          plan_version: "2020-01-01T00:00:00.000Z",
          submitted_at: nowIso(),
          decisions: [
            {
              workstream_id: plan.workstreams[0]!.workstream_id,
              decision: "APPROVE",
            },
          ],
        },
        "operator:test",
      ),
    ).rejects.toThrow("PLAN_STALE");
  });

  it("fails closed on unknown workstream_id", async () => {
    const { missionId, plan } = await seedPlan();

    await expect(
      applyDecisionBundle(
        {
          mission_id: missionId,
          plan_version: plan.updated_at,
          submitted_at: nowIso(),
          decisions: [
            {
              workstream_id: "NONEXISTENT-WS-999",
              decision: "APPROVE",
            },
          ],
        },
        "operator:test",
      ),
    ).rejects.toThrow("WORKSTREAM_NOT_FOUND");
  });

  it("fails closed when approving WS whose dependency is still PROPOSED", async () => {
    const { missionId, plan } = await seedPlan();

    // Find a workstream with dependencies, or inject one
    const wsWithDep = plan.workstreams.find((ws) => ws.dependencies.length > 0);
    if (!wsWithDep) return; // skip if no deps in generated plan

    await expect(
      applyDecisionBundle(
        {
          mission_id: missionId,
          plan_version: plan.updated_at,
          submitted_at: nowIso(),
          decisions: [
            {
              workstream_id: wsWithDep.workstream_id,
              decision: "APPROVE",
              // Intentionally NOT including the dependency — it stays PROPOSED
            },
          ],
        },
        "operator:test",
      ),
    ).rejects.toThrow("DEPENDENCY_NOT_APPROVED");
  });

  it("mixed bundle: some APPROVE, one EDIT — verifications correct", async () => {
    const { missionId, plan } = await seedPlan();
    if (plan.workstreams.length < 2) return;

    // Edit the LAST workstream (no others depend on it); approve the rest.
    const sorted = [...plan.workstreams].sort((a, b) => a.execution_order - b.execution_order);
    const last = sorted[sorted.length - 1]!;
    const toApprove = sorted.slice(0, -1);

    const decisions = [
      ...toApprove.map((ws) => ({
        workstream_id: ws.workstream_id,
        decision: "APPROVE" as const,
      })),
      { workstream_id: last.workstream_id, decision: "EDIT" as const, edit_notes: "Review" },
    ];

    const result = await applyDecisionBundle(
      {
        mission_id: missionId,
        plan_version: plan.updated_at,
        submitted_at: nowIso(),
        decisions,
      },
      "operator:test",
    );

    expect(result.ok).toBe(true);
    const editV = result.verifications.find((v) => v.workstream_id === last.workstream_id)!;
    expect(editV.final_state).toBe("PROPOSED");

    const approveVs = result.verifications.filter((v) => v.workstream_id !== last.workstream_id);
    for (const v of approveVs) {
      expect(["APPROVED", "DISPATCHABLE"]).toContain(v.final_state);
    }
  });
});
