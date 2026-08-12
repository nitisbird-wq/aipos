import { describe, expect, it } from "vitest";
import {
  assertAcyclicDependencies,
  assertNonGenericWorkstreamTitles,
  WorkstreamPlanSchema,
} from "@/lib/orchestration/workstream-plan";

const ws = (id: string, deps: string[] = [], extra: Record<string, unknown> = {}) => ({
  workstream_id: id,
  mission_id: "MIS-3",
  parent_linear_issue: "NIT-9",
  linear_issue_id: null,
  title: "Collect competitor pricing facts",
  objective: "Gather pricing facts for three competitors into a table",
  required_capabilities: ["research.synthesize"],
  dependencies: deps,
  reasoning_action_refs: ["ra1"],
  is_integration_workstream: false,
  primary_operator: "unassigned" as const,
  supporting_operator: null,
  tools_required: [],
  inputs: {},
  expected_output: {
    type: "document" as const,
    description: "Competitor pricing fact table",
  },
  acceptance_criteria: ["Three competitors listed"],
  risk_level: "L1" as const,
  approval_required: false,
  execution_order: 1,
  status: "proposed" as const,
  correlation_id: "c",
  idempotency_key: `ws:${id}:v1`,
  canonical_token: `AIPOS_WORKSTREAM_ID=${id}`,
  ...extra,
});

describe("WorkstreamPlanSchema ADR-006.v2", () => {
  it("accepts a work-first decomposer plan", () => {
    const plan = WorkstreamPlanSchema.parse({
      plan_id: "plan-MIS-3-v1",
      mission_id: "MIS-3",
      parent_linear_issue: "NIT-9",
      plan_version: 1,
      mission_objective: "Draft Monday briefing of top three priorities",
      desired_outcome: "Owner can review priorities in under five minutes",
      success_criteria: ["Exactly three priorities", "Each has next action"],
      domain: "executive_reporting",
      final_deliverable: "One-page Monday briefing note",
      explicit_assumptions: [
        { id: "a1", text: "Use provided open-work list only", source: "user_stated" },
      ],
      owner_questions: [],
      reasoning_actions: [
        { id: "ra1", action: "Rank open-work items", produces: "ranked_list" },
        {
          id: "ra2",
          action: "Draft briefing",
          produces: "briefing",
          consumes: ["ranked_list"],
        },
      ],
      integration_required: false,
      mission_risk_level: "L1",
      workstreams: [
        ws("WS-MIS-3-01"),
        ws("WS-MIS-3-02", ["WS-MIS-3-01"], {
          title: "Draft one-page Monday briefing",
          objective: "Write the briefing from the ranked list",
          reasoning_action_refs: ["ra2"],
          required_capabilities: ["docs.write"],
          expected_output: {
            type: "document",
            description: "One-page Monday briefing note",
          },
        }),
      ],
      correlation_id: "corr",
      created_at: "2026-08-12T18:00:00.000Z",
      decomposer_version: "ADR-006.v2",
    });
    expect(plan.workstreams).toHaveLength(2);
    expect(plan.decomposer_version).toBe("ADR-006.v2");
  });
});

describe("assertAcyclicDependencies", () => {
  it("accepts a DAG", () => {
    expect(
      assertAcyclicDependencies([
        { workstream_id: "WS-MIS-3-01", dependencies: [] },
        { workstream_id: "WS-MIS-3-02", dependencies: ["WS-MIS-3-01"] },
      ]),
    ).toEqual({ ok: true });
  });

  it("detects a cycle", () => {
    const result = assertAcyclicDependencies([
      { workstream_id: "WS-MIS-3-01", dependencies: ["WS-MIS-3-02"] },
      { workstream_id: "WS-MIS-3-02", dependencies: ["WS-MIS-3-01"] },
    ]);
    expect(result.ok).toBe(false);
  });
});

describe("assertNonGenericWorkstreamTitles", () => {
  it("flags understand-scope / create-main-output placeholders", () => {
    expect(
      assertNonGenericWorkstreamTitles([
        { title: "Understand scope" },
        { title: "Create main output" },
      ]).ok,
    ).toBe(false);
  });
});
