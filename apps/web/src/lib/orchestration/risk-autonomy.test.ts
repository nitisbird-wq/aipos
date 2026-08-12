import { describe, expect, it } from "vitest";
import { evaluateRiskAutonomy } from "@/lib/orchestration/risk-autonomy";
import { RoutingDecisionSchema, WorkstreamSchema } from "@/lib/schemas/workstream";

const baseWorkstream = {
  workstream_id: "WS-MIS-3-01",
  mission_id: "MIS-3",
  parent_linear_issue: "NIT-9",
  linear_issue_id: null,
  notion_mission_page_id: "3babc165-be4c-8182-9736-f4fd0ad5d7fe",
  title: "Draft Monday briefing outline",
  objective: "Produce a one-page outline of three priorities",
  required_capabilities: ["docs.write"],
  dependencies: [],
  primary_operator: "claude" as const,
  supporting_operator: "notion" as const,
  tools_required: ["notion.read"],
  inputs: { mission_brief_ref: "MIS-3" },
  expected_output: { type: "document" as const, location_hint: "notion" as const },
  acceptance_criteria: ["Exactly three prioritized items listed"],
  risk_level: "L1" as const,
  approval_required: false,
  approval_reason: null,
  execution_order: 1,
  parallel_group: "A",
  status: "ready" as const,
  correlation_id: "corr-mis-3-ws-01",
  idempotency_key: "ws:MIS-3:01:v1",
  canonical_token: "AIPOS_WORKSTREAM_ID=WS-MIS-3-01",
};

describe("WorkstreamSchema", () => {
  it("accepts a valid workstream.v1 object", () => {
    const parsed = WorkstreamSchema.parse(baseWorkstream);
    expect(parsed.workstream_id).toBe("WS-MIS-3-01");
    expect(parsed.canonical_token).toBe("AIPOS_WORKSTREAM_ID=WS-MIS-3-01");
  });

  it("rejects invalid workstream ids", () => {
    expect(() =>
      WorkstreamSchema.parse({ ...baseWorkstream, workstream_id: "WS-1" }),
    ).toThrow();
  });
});

describe("RoutingDecisionSchema", () => {
  it("accepts an auto-dispatch routing decision", () => {
    const decision = RoutingDecisionSchema.parse({
      decision_id: "rd-1",
      workstream_id: "WS-MIS-3-01",
      mission_id: "MIS-3",
      required_capabilities: ["docs.write"],
      eligible_operators: [
        {
          operator: "claude",
          score: 5,
          credential_verified: true,
          reasons: ["capability match"],
        },
      ],
      primary_operator: "claude",
      supporting_operator: "notion",
      tools_required: ["notion.read"],
      risk_level: "L1",
      autonomy_class: "auto_dispatch",
      approval_required: false,
      approval_reason: null,
      dispatch_action: "dispatch_now",
      expected_artifact: { type: "document", location_hint: "notion" },
      acceptance_criteria: ["Outline complete"],
      correlation_id: "corr-1",
      decided_at: "2026-08-12T18:00:00.000Z",
      policy_version: "ADR-006.D-006.4",
    });
    expect(decision.dispatch_action).toBe("dispatch_now");
    expect(decision.approval_required).toBe(false);
  });
});

describe("evaluateRiskAutonomy (ADR-006 D-006.4)", () => {
  it("auto-dispatches L0–L1 without a plan approval gate", () => {
    const result = evaluateRiskAutonomy({
      risk_level: "L1",
      required_capabilities: ["docs.write"],
      has_unknown_capability: false,
      has_eligible_verified_operator: true,
      authority_known: true,
    });
    expect(result.autonomy_class).toBe("auto_dispatch");
    expect(result.approval_required).toBe(false);
    expect(result.dispatch_action).toBe("dispatch_now");
  });

  it("auto-dispatches L2 when reversible and within delegated authority", () => {
    const result = evaluateRiskAutonomy({
      risk_level: "L2",
      required_capabilities: ["automation.flow"],
      has_eligible_verified_operator: true,
      authority_known: true,
      reversible: true,
      within_delegated_authority: true,
    });
    expect(result.dispatch_action).toBe("dispatch_now");
    expect(result.approval_required).toBe(false);
    expect(result.autonomy_class).toBe("auto_if_reversible");
  });

  it("requires Human Gate for L2 when not reversible", () => {
    const result = evaluateRiskAutonomy({
      risk_level: "L2",
      required_capabilities: ["automation.flow"],
      has_eligible_verified_operator: true,
      authority_known: true,
      reversible: false,
      within_delegated_authority: true,
    });
    expect(result.dispatch_action).toBe("await_human");
    expect(result.approval_required).toBe(true);
  });

  it("requires Human Approval for L3–L4", () => {
    const result = evaluateRiskAutonomy({
      risk_level: "L3",
      required_capabilities: ["code.implement"],
      has_eligible_verified_operator: true,
      authority_known: true,
    });
    expect(result.dispatch_action).toBe("await_human");
    expect(result.block_codes).toContain("RISK_REQUIRES_HUMAN");
  });

  it("fail-closes unknown capability/operator/authority", () => {
    const result = evaluateRiskAutonomy({
      risk_level: "L0",
      required_capabilities: ["mystery.thing"],
      has_unknown_capability: true,
      has_eligible_verified_operator: false,
      authority_known: false,
    });
    expect(result.autonomy_class).toBe("fail_closed");
    expect(result.dispatch_action).toBe("block");
    expect(result.block_codes).toEqual(
      expect.arrayContaining([
        "UNKNOWN_CAPABILITY",
        "UNKNOWN_AUTHORITY",
        "NO_ELIGIBLE_OPERATOR",
      ]),
    );
  });

  it("requires Human for domain.*, secrets, deploy, merge, irreversible, sensitive external", () => {
    const cases = [
      { required_capabilities: ["domain.police.generic"] },
      { required_capabilities: ["docs.write"], involves_secrets: true },
      { required_capabilities: ["docs.write"], involves_production_change: true },
      { required_capabilities: ["docs.write"], involves_merge_or_deploy: true },
      { required_capabilities: ["docs.write"], irreversible: true },
      { required_capabilities: ["docs.write"], sensitive_external_write: true },
    ] as const;

    for (const extra of cases) {
      const result = evaluateRiskAutonomy({
        risk_level: "L1",
        has_eligible_verified_operator: true,
        authority_known: true,
        ...extra,
      });
      expect(result.approval_required).toBe(true);
      expect(["await_human", "block"]).toContain(result.dispatch_action);
    }
  });
});
