import { describe, expect, it } from "vitest";
import {
  SubtaskCommandSchema,
  SubtaskRiskSchema,
  SubtaskSchema,
  SubtaskStatusSchema,
} from "@/lib/schemas/subtask";

const validSubtask = {
  subtask_id: "SUB-1",
  plan_id: "PLN-1",
  mission_id: "MIS-1",
  status: "proposed" as const,
  risk: "L0" as const,
  depends_on: [],
  body: {},
  created_at: "2026-08-25T00:00:00.000Z",
  updated_at: "2026-08-25T00:00:00.000Z",
};

describe("SubtaskStatusSchema", () => {
  it("accepts all PHASE_3_ARCHITECTURE.md §3.3 states", () => {
    for (const status of ["proposed", "approved", "ready", "blocked", "cancelled"]) {
      expect(SubtaskStatusSchema.parse(status)).toBe(status);
    }
  });

  it("rejects a post-3a execution state", () => {
    expect(() => SubtaskStatusSchema.parse("in_progress")).toThrow();
  });
});

describe("SubtaskRiskSchema", () => {
  it("accepts only L0/L1 (P3-C2: L2+ out of scope for 3a)", () => {
    expect(SubtaskRiskSchema.parse("L0")).toBe("L0");
    expect(SubtaskRiskSchema.parse("L1")).toBe("L1");
    expect(() => SubtaskRiskSchema.parse("L2")).toThrow();
  });
});

describe("SubtaskSchema", () => {
  it("parses a well-formed subtask", () => {
    expect(SubtaskSchema.parse(validSubtask)).toEqual(validSubtask);
  });

  it("requires depends_on entries to carry the SUB- prefix", () => {
    expect(() => SubtaskSchema.parse({ ...validSubtask, depends_on: ["not-a-subtask"] })).toThrow();
  });

  it("accepts a valid dependency chain", () => {
    const withDep = { ...validSubtask, subtask_id: "SUB-2", depends_on: ["SUB-1"] };
    expect(SubtaskSchema.parse(withDep).depends_on).toEqual(["SUB-1"]);
  });
});

describe("SubtaskCommandSchema", () => {
  it("accepts all command-only transitions (ADR-005 D-005.4)", () => {
    for (const command of [
      "subtask_generate",
      "subtask_approve_set",
      "subtask_mark_ready",
      "subtask_cancel",
    ]) {
      expect(SubtaskCommandSchema.parse({ command }).command).toBe(command);
    }
  });
});
