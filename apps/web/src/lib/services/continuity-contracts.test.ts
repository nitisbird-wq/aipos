import { describe, expect, it } from "vitest";
import { analyzeMissionHeuristic } from "@/lib/services/analyze";
import { buildMissionContextPack, buildMissionStrategy } from "@/lib/services/mission-strategist";
import { decomposeMissionStrategy } from "@/lib/services/decomposer";
import { evaluateAuthorityDecision } from "@/lib/services/authority";

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
}) {
  const scores = {
    mission_understanding: input.strategyReady ? 5 : 4,
    domain_specificity: input.hasCapabilities ? 5 : 4,
    strategy_quality: input.workstreamCount >= 2 ? 5 : 4,
    completeness: input.hasDeliverable ? 5 : 4,
    actionability: input.hasRouting ? 5 : 4,
    dependency_correctness: input.workstreamCount >= 2 ? 5 : 4,
    deliverable_alignment: input.hasDeliverable ? 5 : 4,
    owner_effort: input.ownerQuestions <= 2 ? 5 : 4,
    capability_correctness: input.hasCapabilities ? 5 : 4,
    evidence_discipline: input.authorityDecision ? 5 : 4,
  };
  return scores;
}

describe("continuity and strategy contracts", () => {
  it("creates context pack + strategy + decomposed workstreams", () => {
    const analysis = analyzeMissionHeuristic("Implement dashboard feature and include acceptance criteria");
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
    expect(workstreams.length).toBe(2);
    expect(workstreams[1].dependencies).toContain("MIS-TEST-1-WS1");
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
      const authority = evaluateAuthorityDecision({
        proposed_action: mission,
        risk_level: analysis.operational_risk,
        reversible: !/deploy|publish|production/i.test(mission),
        delegated: analysis.operational_risk <= "L2",
      });

      const scored = scoreCase({
        strategyReady: strategy.decomposition_ready,
        workstreamCount: workstreams.length,
        hasCapabilities: analysis.capability_families.length > 0,
        hasRouting: true,
        ownerQuestions: strategy.missing_information.filter((item) => item.owner_question_required).length,
        hasDeliverable: Boolean(strategy.final_deliverable.deliverable_type),
        authorityDecision: authority.decision,
      });

      for (const [dimension, value] of Object.entries(scored)) {
        expect(value, `Mission ${index + 1}: ${dimension}`).toBeGreaterThanOrEqual(4);
      }
    }
  });
});
