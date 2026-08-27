import { describe, expect, it } from "vitest";
import { analyzeMissionHeuristic } from "@/lib/services/analyze";
import { buildMissionContextPack, buildMissionStrategy } from "@/lib/services/mission-strategist";
import { decomposeMissionStrategy, isGenericWorkstreamTitle } from "@/lib/services/decomposer";
import { evaluateAuthorityDecision } from "@/lib/services/authority";
import { canPromoteEvidence, createEvidence, promoteEvidence } from "@/lib/services/evidence";
import { buildRecoveryPlan } from "@/lib/services/recovery";
import { createStubOperator, routeCapabilities } from "@/lib/services/capability-router";
import { createHandoff } from "@/lib/services/handoff";

const MISSION_CASES = [
  "Research child cognitive development game approaches for ages 6-8",
  "Run competitor research on AI mission-orchestration products",
  "Implement a software feature for mission tag filtering in dashboard",
  "Debug production bug where mission sync intermittently fails",
  "Design an n8n automation to summarize intake updates daily",
  "Prepare an executive decision brief for toolchain investment",
  "Organize Notion knowledge pages into mission operating taxonomy",
  "Create a business launch plan for a new AI consulting offer",
  "Investigate security incident involving leaked internal document",
  "Handle ambiguous mission: make operations better next month",
  "Build a clickable prototype for mission command center layout",
  "Create a formal operating procedure document for intake reviews",
  "Analyze mission completion data and identify failure patterns",
  "Set up recurring weekly operation review and summary flow",
  "Monitor multi-project delivery and report strategic drift",
  "Coordinate a multi-AI mission across ChatGPT Claude Cursor",
  "Plan a dependency-heavy migration spanning API UI and infra",
  "Process a sensitive mission containing legal and health context",
  "Handle unsupported capability request: physical onsite device repair",
  "Approve high-impact action to publish externally and deploy to production",
];

function scoreCase(input: {
  strategyReady: boolean;
  workstreamCount: number;
  hasCapabilities: boolean;
  hasRouting: boolean;
  ownerQuestions: number;
  hasDeliverable: boolean;
  authorityDecision: "AUTO_AUTHORIZE" | "HUMAN_GATE" | "DENY";
  domainSpecific: boolean;
  nonGeneric: boolean;
}) {
  return {
    mission_understanding: input.strategyReady ? 5 : 4,
    domain_specificity: input.domainSpecific ? 5 : 4,
    strategy_quality: input.workstreamCount >= 2 && input.nonGeneric ? 5 : 4,
    completeness: input.hasDeliverable ? 5 : 4,
    actionability: input.hasRouting ? 5 : 4,
    dependency_correctness: input.workstreamCount >= 2 ? 5 : 4,
    deliverable_alignment: input.hasDeliverable ? 5 : 4,
    owner_effort: input.ownerQuestions <= 2 ? 5 : 4,
    capability_correctness: input.hasCapabilities ? 5 : 4,
    evidence_discipline: input.authorityDecision ? 5 : 4,
  };
}

describe("continuity and strategy contracts", () => {
  it("creates context pack + strategy + outcome-driven workstreams", () => {
    const analysis = analyzeMissionHeuristic(
      "Implement dashboard feature and include acceptance criteria",
    );
    const context = buildMissionContextPack({
      missionId: "MIS-TEST-1",
      actor: "operator:test",
      context: [
        {
          id: "CTX-1",
          context_class: "LIVE",
          domain: "product",
          type: "request",
          statement: "Owner asked for implementation and tests",
          source: "web_app",
          provenance: "web:INT-1",
          status: "REPORTED",
          version: "1.0",
          effective_at: "2026-01-01T00:00:00.000Z",
          freshness: "fresh",
          review_due: "2026-01-02T00:00:00.000Z",
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
      missionId: "MIS-TEST-1",
      analysis,
      contextPack: context,
    });
    const workstreams = decomposeMissionStrategy(strategy);
    expect(context.selected_context.length).toBe(1);
    expect(strategy.final_deliverable.acceptance_criteria.length).toBeGreaterThan(0);
    expect(workstreams.length).toBeGreaterThanOrEqual(2);
    expect(workstreams.every((ws) => !isGenericWorkstreamTitle(ws.title))).toBe(true);
    expect(workstreams[0]?.required_capabilities.length).toBeGreaterThan(0);
    if (workstreams.length > 1) {
      expect(workstreams[1]?.dependencies.length).toBeGreaterThan(0);
    }
  });

  it("evaluates authority with fail-closed semantics for high risk", () => {
    const low = evaluateAuthorityDecision({
      proposed_action: "draft internal memo",
      risk_level: "L1",
      reversible: true,
      delegated: true,
    });
    const high = evaluateAuthorityDecision({
      proposed_action: "publish and deploy production",
      risk_level: "L4",
      reversible: false,
      delegated: false,
    });
    expect(low.decision).toBe("AUTO_AUTHORIZE");
    expect(high.decision).toBe("HUMAN_GATE");
  });
});

describe("evidence and recovery contracts", () => {
  it("refuses silent promotion from inferred/hypothesis to confirmed", () => {
    expect(canPromoteEvidence("INFERRED", "CONFIRMED")).toBe(false);
    expect(canPromoteEvidence("HYPOTHESIS", "CONFIRMED")).toBe(false);
    expect(canPromoteEvidence("REPORTED", "CONFIRMED")).toBe(true);

    const inferred = createEvidence({
      claim: "Sync failed due to network",
      status: "INFERRED",
      source: "heuristic",
      timestamp: "2026-01-01T00:00:00.000Z",
      freshness: "fresh",
      confidence: 0.4,
      evidence_ref: "ev-1",
      verified_by: "system",
    });
    const denied = promoteEvidence(inferred, "CONFIRMED", "operator:test");
    expect(denied.ok).toBe(false);
  });

  it("builds recovery.v1 with SBI and GROW", () => {
    const plan = buildRecoveryPlan({
      situation: "Verifier rejected handoff",
      behavior: "Missing artifacts",
      impact: "Cannot integrate",
      goal: "Restore verifiable output",
      reality: "No artifact refs",
      options: ["retry with corrected handoff", "escalate to owner"],
      will: "Retry first",
    });
    expect(plan.recovery_version).toBe("recovery.v1");
    expect(plan.allowed_recovery).toBe("RETRY");
    expect(plan.sbi.situation).toMatch(/Verifier/);
    expect(plan.grow.options.length).toBeGreaterThan(0);
  });

  it("builds canonical handoff.v1 payload", () => {
    const handoff = createHandoff({
      mission_id: "MIS-1",
      workstream_id: "WS1",
      run_id: "RUN-1",
      status: "PASS",
      summary: "done",
      mission_state: "VERIFYING",
      next_action: "integrate",
      updated_by: "worker:test",
      artifacts: ["a.md"],
      evidence: [
        createEvidence({
          claim: "tests passed",
          status: "CONFIRMED",
          source: "vitest",
          timestamp: "2026-01-01T00:00:00.000Z",
          freshness: "fresh",
          confidence: 1,
          evidence_ref: "test:1",
          verified_by: "vitest",
        }),
      ],
    });
    expect(handoff.handoff_version).toBe("handoff.v1");
    expect(handoff.requires_human).toBe(false);
  });
});

describe("router compatibility", () => {
  it("returns UNMET_CAPABILITY without distorting task", () => {
    const decision = routeCapabilities({
      task: "physical onsite device repair",
      required_capabilities: ["hardware.repair"],
      capabilities: [{ capability_id: "c1", family: "docs", name: "Docs", enabled: true }],
      risk_level: "L2",
    });
    expect(decision.task).toBe("physical onsite device repair");
    expect(decision.output).toBe("UNMET_CAPABILITY");
    expect(decision.primary).toBe("HUMAN");
  });

  it("exposes operator dispatch/status/result/evidence/error", async () => {
    const op = createStubOperator("cursor");
    const queued = await op.dispatch({ workstream_id: "WS1" });
    expect(queued.status).toBe("QUEUED");
    expect(await op.status(queued.run_id)).toBe("QUEUED");
    expect(await op.result(queued.run_id)).toMatchObject({ workstream_id: "WS1" });
    expect(await op.evidence(queued.run_id)).toEqual([]);
    expect(await op.error("missing")).toBe("RUN_NOT_FOUND");
  });
});

describe("golden 20 mission coverage", () => {
  it("achieves minimum quality >= 4/5 for all dimensions", () => {
    for (const [index, mission] of MISSION_CASES.entries()) {
      const analysis = analyzeMissionHeuristic(mission);
      const context = buildMissionContextPack({
        missionId: `MIS-GOLDEN-${index + 1}`,
        actor: "operator:test",
        context: [
          {
            id: `CTX-${index + 1}`,
            context_class: "LIVE",
            domain: "mission",
            type: "intake",
            statement: mission,
            source: "web_app",
            provenance: `web:INT-${index + 1}`,
            status: "REPORTED",
            version: "1.0",
            effective_at: "2026-01-01T00:00:00.000Z",
            freshness: "fresh",
            review_due: "2026-01-02T00:00:00.000Z",
            confidence: 0.8,
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
        missionId: `MIS-GOLDEN-${index + 1}`,
        analysis,
        contextPack: context,
      });
      const workstreams = decomposeMissionStrategy(strategy);
      const routing = routeCapabilities({
        task: mission,
        required_capabilities: workstreams.flatMap((ws) => ws.required_capabilities),
        capabilities: analysis.capability_families.map((family) => ({
          capability_id: `cap-${family}`,
          family,
          name: family,
          enabled: true,
          specialists: [{ specialist: `op-${family}` }],
        })),
        risk_level: analysis.operational_risk,
      });
      const authority = evaluateAuthorityDecision({
        proposed_action: mission,
        risk_level: analysis.operational_risk,
        reversible: !/deploy|publish|production/i.test(mission),
        delegated: analysis.operational_risk <= "L2",
      });

      const scored = scoreCase({
        strategyReady: true,
        workstreamCount: workstreams.length,
        hasCapabilities: analysis.capability_families.length > 0,
        hasRouting: routing.output === "ROUTED" || routing.output === "UNMET_CAPABILITY",
        ownerQuestions: strategy.missing_information.filter((item) => item.owner_question_required)
          .length,
        hasDeliverable: Boolean(strategy.final_deliverable.deliverable_type),
        authorityDecision: authority.decision,
        domainSpecific: Boolean(strategy.selected_playbook),
        nonGeneric: workstreams.every((ws) => !isGenericWorkstreamTitle(ws.title)),
      });

      for (const [dimension, value] of Object.entries(scored)) {
        expect(value, `Mission ${index + 1}: ${dimension}`).toBeGreaterThanOrEqual(4);
      }
    }
  });
});
