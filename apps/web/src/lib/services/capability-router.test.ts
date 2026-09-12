import { describe, expect, it } from "vitest";
import { routeCapabilities } from "@/lib/services/capability-router";
import type { Capability } from "@/lib/schemas/policy";

function capability(input: {
  id: string;
  family: string;
  operator: string;
  status?: string;
}): Capability {
  return {
    capability_id: input.id,
    family: input.family,
    name: input.id,
    enabled: true,
    status: input.status ?? "VERIFIED",
    specialists: [{ specialist_id: input.operator, enabled: true }],
  };
}

function route(input: {
  required: string[];
  capabilities: Capability[];
  currentOperator?: string;
}) {
  return routeCapabilities({
    task: "Produce a verified deliverable",
    required_capabilities: input.required,
    capabilities: input.capabilities,
    current_operator: input.currentOperator,
    risk_level: "L1",
  });
}

// prettier-ignore
describe("best-fit capability routing", () => {
  it("keeps work with the current verified operator", () => {
    const decision = route({
      required: ["documents"],
      capabilities: [capability({ id: "CAP-DOCS", family: "documents", operator: "worker:docs" })],
      currentOperator: "worker:docs",
    });
    expect(decision.output).toBe("ROUTED");
    expect(decision.routing_mode).toBe("KEEP");
  });

  it("adds assistance when capability truth is partial", () => {
    const decision = route({
      required: ["documents"],
      capabilities: [
        capability({
          id: "CAP-DOCS",
          family: "documents",
          operator: "worker:docs",
          status: "PARTIAL",
        }),
      ],
      currentOperator: "worker:docs",
    });
    expect(decision.routing_mode).toBe("ASSIST");
  });

  it("hands off when the current operator is not eligible", () => {
    const decision = route({
      required: ["documents"],
      capabilities: [capability({ id: "CAP-DOCS", family: "documents", operator: "worker:docs" })],
      currentOperator: "supervisor",
    });
    expect(decision.routing_mode).toBe("HANDOFF");
    expect(decision.primary).toBe("worker:docs");
  });

  it("splits work when no single operator covers every requirement", () => {
    const decision = route({
      required: ["documents", "spreadsheets"],
      capabilities: [
        capability({ id: "CAP-DOCS", family: "documents", operator: "worker:docs" }),
        capability({ id: "CAP-SHEETS", family: "spreadsheets", operator: "worker:sheets" }),
      ],
    });
    expect(decision.routing_mode).toBe("SPLIT");
    expect(decision.coverage).toHaveLength(2);
  });

  it("requires a human when any required capability lacks verified coverage", () => {
    const decision = route({
      required: ["documents", "legal"],
      capabilities: [capability({ id: "CAP-DOCS", family: "documents", operator: "worker:docs" })],
    });
    expect(decision.output).toBe("UNMET_CAPABILITY");
    expect(decision.routing_mode).toBe("HUMAN_REQUIRED");
    expect(decision.explanation).toContain("No verified routable operator covers legal");
  });
});
