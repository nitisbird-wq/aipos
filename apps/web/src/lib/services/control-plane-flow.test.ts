import { afterEach, describe, expect, it } from "vitest";
import path from "path";
import { promises as fs } from "fs";
import { DevFileRepository } from "@/lib/repositories/dev-file-store";
import { analyzeIntake, confirmIntake, createIntake } from "@/lib/services/intake-service";
import {
  initializeMissionControlState,
  runSupervisorAssessment,
} from "@/lib/services/aipos-supervisor";
import { buildMissionContextPack, buildMissionStrategy } from "@/lib/services/mission-strategist";
import { analyzeMissionHeuristic } from "@/lib/services/analyze";
import { decomposeMissionStrategy } from "@/lib/services/decomposer";
import { dispatchWorkstreams } from "@/lib/services/workstream-dispatcher";
import { buildWorkerAssignmentPackages } from "@/lib/services/operator-contract";
import {
  verifyAndIntegrateHandoff,
  integrateMissionResults,
} from "@/lib/services/verifier-integrator";
import { evaluateMissionHealth } from "@/lib/services/health-supervisor";
import { getMissionControlState } from "@/lib/services/control-plane-state";

const tmpRoot = path.join(process.cwd(), ".data-test-control-plane");

afterEach(async () => {
  globalThis.__aiposRepo = undefined;
  await fs.rm(tmpRoot, { recursive: true, force: true });
});

describe("AIPOS control plane v1 mission flow", () => {
  it("runs mission -> decompose -> dispatch -> worker-ready -> verification -> integration -> health", async () => {
    await fs.rm(tmpRoot, { recursive: true, force: true });
    globalThis.__aiposRepo = new DevFileRepository(tmpRoot);
    globalThis.__aiposPersistenceMode = "dev-file";
    process.env.NOTION_ADAPTER = "mock";
    process.env.NOTION_MOCK_SUCCESS = "true";

    const { bundle } = await createIntake(
      {
        raw_request:
          "Implement a small TypeScript helper and document it with measurable success criteria",
        idempotency_key: "IDEM-CP-1",
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
    if (!confirmed.ok) return;

    await initializeMissionControlState(confirmed.mission_id);
    const assessment = await runSupervisorAssessment(confirmed.mission_id);
    expect(assessment.next_action.length).toBeGreaterThan(0);

    const analysis = analyzeMissionHeuristic(
      "Implement a small TypeScript helper and document it with measurable success criteria",
    );
    const contextPack = buildMissionContextPack({
      missionId: confirmed.mission_id,
      actor: "operator:test",
      context: [
        {
          id: "CTX-CP-1",
          context_class: "LIVE",
          domain: "mission",
          type: "request",
          statement:
            "Implement a small TypeScript helper and document it with measurable success criteria",
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
    });
    const strategy = buildMissionStrategy({
      missionId: confirmed.mission_id,
      analysis,
      contextPack,
    });
    const workstreams = decomposeMissionStrategy(strategy);

    const memoryLinear: Record<string, { id: string; title: string }> = {};
    const dispatch = await dispatchWorkstreams({
      missionId: confirmed.mission_id,
      workstreams,
      actor: "dispatcher",
      adapter: {
        searchByCorrelationId: async (correlationId) => memoryLinear[correlationId] ?? null,
        createWorkstreamIssue: async (input) => {
          const row = {
            id: `LIN-${Object.keys(memoryLinear).length + 1}`,
            title: input.title,
          };
          memoryLinear[input.correlationId] = row;
          return row;
        },
      },
    });
    expect(dispatch.blocked).toHaveLength(0);
    expect(dispatch.dispatched.length).toBeGreaterThan(0);

    const assignments = await buildWorkerAssignmentPackages(confirmed.mission_id);
    expect(assignments.length).toBeGreaterThan(0);
    expect(assignments[0].high_impact_actions_allowed).toBe(false);

    const first = assignments[0];
    const verification = await verifyAndIntegrateHandoff({
      missionId: confirmed.mission_id,
      actor: "verifier",
      handoff: {
        handoff_version: "handoff.v1",
        mission_id: confirmed.mission_id,
        workstream_id: first.workstream_id,
        run_id: first.run_id,
        status: "PASS",
        summary: "Worker completed expected output",
        mission_state: "VERIFYING",
        received_context: first.scoped_context,
        completed_work: ["completed task"],
        changes_made: ["updated code and tests"],
        verification: ["unit tests passed"],
        remaining_work: [],
        failures: [],
        decisions: ["selected deterministic approach"],
        assumptions: ["no external dependency required"],
        evidence: [
          {
            claim: "Output produced",
            status: "CONFIRMED",
            source: "test_run",
            timestamp: new Date().toISOString(),
            freshness: "fresh",
            confidence: 0.95,
            evidence_ref: "test:control-plane",
            verified_by: "verifier",
          },
        ],
        evidence_refs: ["test:control-plane"],
        blockers: [],
        artifacts: ["/tmp/artifacts/output.md"],
        next_action: "Integrate into final mission deliverable",
        requires_human: false,
        human_action_required: null,
        risk_notes: [],
        updated_at: new Date().toISOString(),
        updated_by: "worker:test",
      },
    });
    expect(verification.status).toBe("PASS");

    const integrated = await integrateMissionResults(confirmed.mission_id);
    expect(integrated.final_status).toBe("READY_FOR_OWNER_REVIEW");

    const health = await evaluateMissionHealth(confirmed.mission_id);
    expect(["HEALTHY", "WARNING", "BLOCKED", "CRITICAL"]).toContain(health.status);

    const state = await getMissionControlState(confirmed.mission_id);
    expect(state.state_version).toBe("control-plane.v1");
    expect(state.workstreams.length).toBeGreaterThan(0);
    expect(state.handoffs.length).toBeGreaterThan(0);
    expect(state.verifications.length).toBeGreaterThan(0);
  });
});
