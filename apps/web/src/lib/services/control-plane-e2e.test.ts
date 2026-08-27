import { afterEach, describe, expect, it, vi } from "vitest";
import path from "path";
import { promises as fs } from "fs";
import { DevFileRepository } from "@/lib/repositories/dev-file-store";
import { analyzeIntake, confirmIntake, createIntake } from "@/lib/services/intake-service";
import { initializeMissionControlState } from "@/lib/services/aipos-supervisor";
import { analyzeMissionHeuristic } from "@/lib/services/analyze";
import { buildMissionContextPack, buildMissionStrategy } from "@/lib/services/mission-strategist";
import { decomposeMissionStrategy } from "@/lib/services/decomposer";
import { dispatchWorkstreams, repairDispatchWriteback } from "@/lib/services/workstream-dispatcher";
import {
  asLinearDispatchAdapter,
  createLiveLinearClient,
  createMockLinearClient,
} from "@/lib/linear/client";
import { getMissionControlState } from "@/lib/services/control-plane-state";
import { evaluateMissionHealth } from "@/lib/services/health-supervisor";
import { evaluateHandoffVerification, verifyHandoff } from "@/lib/services/verifier";
import { integrateMissionResults } from "@/lib/services/result-integrator";
import { buildRecoveryPlan } from "@/lib/services/recovery";

const tmpRoot = path.join(process.cwd(), ".data-test-control-plane-e2e");

afterEach(async () => {
  globalThis.__aiposRepo = undefined;
  (globalThis as { __aiposLinearMock?: unknown }).__aiposLinearMock = undefined;
  vi.unstubAllGlobals();
  process.env.LINEAR_ADAPTER = "mock";
  delete process.env.LINEAR_API_KEY;
  delete process.env.LINEAR_TEAM_ID;
  await fs.rm(tmpRoot, { recursive: true, force: true });
});

async function seedMission(idempotencyKey: string) {
  globalThis.__aiposRepo = new DevFileRepository(tmpRoot);
  globalThis.__aiposPersistenceMode = "dev-file";
  process.env.NOTION_ADAPTER = "mock";
  process.env.NOTION_MOCK_SUCCESS = "true";

  const { bundle } = await createIntake(
    {
      raw_request:
        "Implement a small TypeScript helper and document it with measurable success criteria",
      idempotency_key: idempotencyKey,
    },
    "operator:test",
  );
  await analyzeIntake(bundle.intake_id, "operator:test");
  const confirmed = await confirmIntake(
    bundle.intake_id,
    { reason: "confirm mission", sensitivity_acknowledged: true },
    "operator:test",
  );
  expect(confirmed.ok).toBe(true);
  if (!confirmed.ok) throw new Error("confirm failed");

  await initializeMissionControlState(confirmed.mission_id);
  const analysis = analyzeMissionHeuristic(bundle.raw_request);
  const strategy = buildMissionStrategy({
    missionId: confirmed.mission_id,
    analysis,
    contextPack: buildMissionContextPack({
      missionId: confirmed.mission_id,
      actor: "operator:test",
      context: [
        {
          id: "CTX-E2E-1",
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
  return {
    missionId: confirmed.mission_id,
    workstreams: decomposeMissionStrategy(strategy),
  };
}

describe("control-plane E2E — Linear adapter + reconcile", () => {
  it("creates via mock adapter, stays idempotent, and reconciles write-back repair", async () => {
    const { missionId, workstreams } = await seedMission("IDEM-E2E-1");
    const adapter = asLinearDispatchAdapter(createMockLinearClient());

    const first = await dispatchWorkstreams({
      missionId,
      workstreams,
      adapter,
      actor: "dispatcher",
    });
    expect(first.blocked).toHaveLength(0);
    expect(first.dispatched.length).toBe(workstreams.length);

    const second = await dispatchWorkstreams({
      missionId,
      workstreams,
      adapter,
      actor: "dispatcher",
    });
    expect(second.dispatched.every((row) => row.reused)).toBe(true);

    const repaired = await repairDispatchWriteback({
      missionId,
      workstreamId: workstreams[0]!.workstream_id,
      linearIssueId: first.dispatched[0]!.linear_issue_id,
      actor: "dispatcher",
    });
    expect(repaired?.linear_issue_id).toBe(first.dispatched[0]!.linear_issue_id);
    expect(repaired?.status).toBe("DISPATCHED");

    const state = await getMissionControlState(missionId);
    expect(state.workstreams.every((row) => Boolean(row.linear_issue_id))).toBe(true);
  });

  it("fails closed on search failure and records reconcile evidence", async () => {
    const { missionId, workstreams } = await seedMission("IDEM-E2E-2");
    let creates = 0;
    const result = await dispatchWorkstreams({
      missionId,
      workstreams: workstreams.slice(0, 1),
      adapter: {
        searchByCorrelationId: async () => {
          throw new Error("search unavailable");
        },
        createWorkstreamIssue: async () => {
          creates += 1;
          return { id: "NOPE", title: "nope" };
        },
      },
      actor: "dispatcher",
    });
    expect(creates).toBe(0);
    expect(result.blocked.length).toBe(1);
    const state = await getMissionControlState(missionId);
    expect(state.mission_state).toBe("BLOCKED");
    expect(state.blockers.length).toBeGreaterThan(0);
  });
});

describe("live Linear client — mocked GraphQL transport", () => {
  it("searches and creates through live client without real network", async () => {
    const fetchMock = vi.fn(async (_url: string, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body ?? "{}")) as { query?: string };
      const q = String(body.query ?? "");
      if (q.includes("issueSearch") || q.includes("Search")) {
        return new Response(
          JSON.stringify({
            data: {
              issueSearch: {
                nodes: [
                  {
                    id: "LIN-LIVE-1",
                    title: "Existing",
                    identifier: "AIP-1",
                    description: "correlation_id=CORR-LIVE-1",
                  },
                ],
              },
            },
          }),
          { status: 200 },
        );
      }
      return new Response(
        JSON.stringify({
          data: {
            issueCreate: {
              success: true,
              issue: { id: "LIN-LIVE-2", title: "Created", identifier: "AIP-2" },
            },
          },
        }),
        { status: 200 },
      );
    });
    vi.stubGlobal("fetch", fetchMock);

    const live = createLiveLinearClient({ apiKey: "lin_test", teamId: "team_test" });
    expect(live.adapterName).toBe("live");
    const found = await live.searchByCorrelationId("CORR-LIVE-1");
    expect(found?.id).toBe("LIN-LIVE-1");
    const created = await live.createWorkstreamIssue({
      correlationId: "CORR-LIVE-2",
      title: "New workstream",
      body: "body",
    });
    expect(created.id).toBe("LIN-LIVE-2");
    expect(fetchMock.mock.calls.length).toBeGreaterThanOrEqual(2);
  });
});

describe("independent Verifier → Recovery → Result Integrator", () => {
  it("can invoke each module on its own", async () => {
    const { missionId, workstreams } = await seedMission("IDEM-E2E-3");
    await dispatchWorkstreams({
      missionId,
      workstreams: workstreams.slice(0, 1),
      adapter: asLinearDispatchAdapter(createMockLinearClient()),
      actor: "dispatcher",
    });

    const plan = buildRecoveryPlan({
      situation: "verification failed",
      behavior: "retry path",
      impact: "mission blocked",
      goal: "restore deliverable",
      reality: "missing artifact",
      options: ["retry with corrected handoff"],
      will: "open recovery workstream",
      preferred: "RETRY",
    });
    expect(plan.allowed_recovery).toBe("RETRY");

    const failHandoff = {
      handoff_version: "handoff.v1" as const,
      mission_id: missionId,
      workstream_id: workstreams[0]!.workstream_id,
      run_id: "RUN-FAIL",
      status: "FAIL" as const,
      summary: "worker failed",
      mission_state: "VERIFYING" as const,
      received_context: [],
      completed_work: [],
      changes_made: [],
      verification: [],
      remaining_work: ["fix"],
      failures: ["missing artifact"],
      decisions: [],
      assumptions: [],
      evidence: [],
      evidence_refs: [],
      blockers: [],
      artifacts: [],
      next_action: "recover",
      requires_human: false,
      human_action_required: null,
      risk_notes: [],
      updated_at: new Date().toISOString(),
      updated_by: "worker:test",
    };
    expect(evaluateHandoffVerification(failHandoff).pass).toBe(false);
    const failed = await verifyHandoff({
      missionId,
      handoff: failHandoff,
      actor: "verifier",
    });
    expect(failed.status).toBe("FAIL");
    expect(failed.recovery_task_created).toBe(true);

    const passHandoff = {
      ...failHandoff,
      run_id: "RUN-PASS",
      status: "PASS" as const,
      summary: "worker succeeded",
      completed_work: ["done"],
      changes_made: ["updated files"],
      verification: ["tests passed"],
      failures: [],
      remaining_work: [],
      artifacts: ["/tmp/artifacts/out.md"],
      evidence: [
        {
          claim: "Output produced",
          status: "CONFIRMED" as const,
          source: "test_run",
          timestamp: new Date().toISOString(),
          freshness: "fresh",
          confidence: 0.95,
          evidence_ref: "test:e2e",
          verified_by: "verifier",
        },
      ],
      evidence_refs: ["test:e2e"],
      next_action: "integrate",
    };
    const passed = await verifyHandoff({
      missionId,
      handoff: passHandoff,
      actor: "verifier",
    });
    expect(passed.status).toBe("PASS");

    const integrated = await integrateMissionResults(missionId);
    expect(integrated.final_status).toBe("READY_FOR_OWNER_REVIEW");
    const health = await evaluateMissionHealth(missionId);
    expect(["HEALTHY", "WARNING", "BLOCKED", "CRITICAL"]).toContain(health.status);
  });
});
