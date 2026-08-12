import { describe, expect, it } from "vitest";
import {
  assertAcyclicDependencies,
  WorkstreamPlanSchema,
} from "@/lib/orchestration/workstream-plan";

const ws = (id: string, deps: string[] = []) => ({
  workstream_id: id,
  mission_id: "MIS-3",
  parent_linear_issue: "NIT-9",
  linear_issue_id: null,
  title: id,
  objective: "obj",
  required_capabilities: ["docs.summarize"],
  dependencies: deps,
  primary_operator: "unassigned" as const,
  supporting_operator: null,
  tools_required: [],
  inputs: {},
  expected_output: { type: "document" as const },
  acceptance_criteria: ["done"],
  risk_level: "L1" as const,
  approval_required: false,
  execution_order: 1,
  status: "proposed" as const,
  correlation_id: "c",
  idempotency_key: `ws:${id}:v1`,
  canonical_token: `AIPOS_WORKSTREAM_ID=${id}`,
});

describe("WorkstreamPlanSchema", () => {
  it("accepts a decomposer plan with multiple workstreams", () => {
    const plan = WorkstreamPlanSchema.parse({
      plan_id: "plan-MIS-3-v1",
      mission_id: "MIS-3",
      parent_linear_issue: "NIT-9",
      plan_version: 1,
      mission_risk_level: "L1",
      workstreams: [ws("WS-MIS-3-01"), ws("WS-MIS-3-02", ["WS-MIS-3-01"])],
      correlation_id: "corr",
      created_at: "2026-08-12T18:00:00.000Z",
      decomposer_version: "ADR-006.v1",
    });
    expect(plan.workstreams).toHaveLength(2);
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
