import { describe, expect, it } from "vitest";
import { PlanCommandSchema, PlanSchema, PlanStatusSchema } from "@/lib/schemas/plan";

const validPlan = {
  plan_id: "PLN-1",
  mission_id: "MIS-1",
  plan_version: 1,
  status: "draft" as const,
  body: { steps: [] },
  created_by: "operator:nitis",
  approved_by: null,
  created_at: "2026-08-25T00:00:00.000Z",
  updated_at: "2026-08-25T00:00:00.000Z",
};

describe("PlanStatusSchema", () => {
  it("accepts all ADR-005 D-005.2 / PHASE_3_ARCHITECTURE.md §3.2 states", () => {
    for (const status of [
      "draft",
      "awaiting_approval",
      "approved",
      "rejected",
      "superseded",
      "cancelled",
    ]) {
      expect(PlanStatusSchema.parse(status)).toBe(status);
    }
  });

  it("rejects an unknown status", () => {
    expect(() => PlanStatusSchema.parse("in_progress")).toThrow();
  });
});

describe("PlanSchema", () => {
  it("parses a well-formed plan", () => {
    expect(PlanSchema.parse(validPlan)).toEqual(validPlan);
  });

  it("requires plan_id to carry the PLN- prefix", () => {
    expect(() => PlanSchema.parse({ ...validPlan, plan_id: "1" })).toThrow();
  });

  it("requires mission_id to carry the MIS- prefix", () => {
    expect(() => PlanSchema.parse({ ...validPlan, mission_id: "1" })).toThrow();
  });

  it("requires plan_version to be a positive integer (monotonic versioning, D-005.7)", () => {
    expect(() => PlanSchema.parse({ ...validPlan, plan_version: 0 })).toThrow();
    expect(() => PlanSchema.parse({ ...validPlan, plan_version: 1.5 })).toThrow();
  });
});

describe("PlanCommandSchema", () => {
  it("accepts all command-only transitions (ADR-005 D-005.4)", () => {
    for (const command of [
      "plan_create",
      "plan_submit",
      "plan_approve",
      "plan_reject",
      "plan_cancel",
    ]) {
      expect(PlanCommandSchema.parse({ command }).command).toBe(command);
    }
  });

  it("rejects a direct status PATCH-style payload", () => {
    expect(() => PlanCommandSchema.parse({ command: "approved" })).toThrow();
  });
});
