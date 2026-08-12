import { describe, expect, it } from "vitest";
import { routeWorkstreamCapabilities } from "@/lib/orchestration/capability-router";
import { RoutingDecisionSchema } from "@/lib/schemas/workstream";

describe("routeWorkstreamCapabilities", () => {
  it("routes docs capability to verified Claude without requiring plan approval on L1", () => {
    const decision = routeWorkstreamCapabilities({
      workstream_id: "WS-MIS-3-01",
      mission_id: "MIS-3",
      required_capabilities: ["docs.summarize"],
      risk_level: "L1",
      acceptance_criteria: ["Summary delivered"],
      expected_artifact: { type: "document" },
      correlation_id: "corr-1",
      operator_credentials: { claude: true, notion: true, cursor: true, n8n: true },
    });

    const parsed = RoutingDecisionSchema.parse({
      ...decision,
      decision_id: "rd-fixed",
    });

    expect(parsed.primary_operator).toBe("claude");
    expect(parsed.approval_required).toBe(false);
    expect(parsed.dispatch_action).toBe("dispatch_now");
  });

  it("routes code capability to Cursor when credential verified", () => {
    const decision = routeWorkstreamCapabilities({
      workstream_id: "WS-MIS-3-02",
      mission_id: "MIS-3",
      required_capabilities: ["code.implement"],
      risk_level: "L1",
      acceptance_criteria: ["PR opened"],
      expected_artifact: { type: "code_pr", location_hint: "github_pr" },
      correlation_id: "corr-2",
      operator_credentials: { cursor: true, claude: false },
    });

    expect(decision.primary_operator).toBe("cursor");
    expect(decision.dispatch_action).toBe("dispatch_now");
  });

  it("fail-closes when Claude preferred but credential unverified and no alternate verified", () => {
    const decision = routeWorkstreamCapabilities({
      workstream_id: "WS-MIS-3-03",
      mission_id: "MIS-3",
      required_capabilities: ["research.synthesize"],
      risk_level: "L1",
      acceptance_criteria: ["Research note"],
      expected_artifact: { type: "document" },
      correlation_id: "corr-3",
      operator_credentials: { claude: false, cursor: false, n8n: false, notion: false },
    });

    expect(decision.dispatch_action).toBe("block");
    expect(decision.primary_operator).toBe("unassigned");
    expect(decision.block_codes).toContain("NO_ELIGIBLE_OPERATOR");
  });

  it("requires human for domain capabilities", () => {
    const decision = routeWorkstreamCapabilities({
      workstream_id: "WS-MIS-3-04",
      mission_id: "MIS-3",
      required_capabilities: ["domain.police.generic"],
      risk_level: "L1",
      acceptance_criteria: ["Escalated"],
      expected_artifact: { type: "decision_brief" },
      correlation_id: "corr-4",
      operator_credentials: { human: true, claude: true },
    });

    expect(decision.approval_required).toBe(true);
    expect(decision.dispatch_action).toBe("await_human");
  });
});
