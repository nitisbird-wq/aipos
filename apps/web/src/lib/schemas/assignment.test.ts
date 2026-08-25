import { describe, expect, it } from "vitest";
import {
  AssignmentCommandSchema,
  AssignmentSchema,
  AssignmentStatusSchema,
} from "@/lib/schemas/assignment";

const validAssignment = {
  assignment_id: "ASG-1",
  mission_id: "MIS-1",
  subtask_id: "SUB-1",
  status: "proposed" as const,
  proposed_specialist: "capability:legal-review",
  approved_by: null,
  created_at: "2026-08-25T00:00:00.000Z",
  updated_at: "2026-08-25T00:00:00.000Z",
};

describe("AssignmentStatusSchema", () => {
  it("accepts all PHASE_3_ARCHITECTURE.md §3.4 states, ending at approved (D-005.1)", () => {
    for (const status of ["proposed", "awaiting_approval", "approved", "rejected", "revoked"]) {
      expect(AssignmentStatusSchema.parse(status)).toBe(status);
    }
  });

  it("rejects a post-3a execution/dispatch state", () => {
    expect(() => AssignmentStatusSchema.parse("dispatched")).toThrow();
  });
});

describe("AssignmentSchema", () => {
  it("parses a well-formed assignment", () => {
    expect(AssignmentSchema.parse(validAssignment)).toEqual(validAssignment);
  });

  it("requires proposed_specialist to be non-empty", () => {
    expect(() => AssignmentSchema.parse({ ...validAssignment, proposed_specialist: "" })).toThrow();
  });

  it("requires subtask_id to carry the SUB- prefix", () => {
    expect(() => AssignmentSchema.parse({ ...validAssignment, subtask_id: "1" })).toThrow();
  });
});

describe("AssignmentCommandSchema", () => {
  it("accepts all command-only transitions (ADR-005 D-005.4)", () => {
    for (const command of [
      "assignment_propose",
      "assignment_submit",
      "assignment_approve",
      "assignment_reject",
      "assignment_revoke",
    ]) {
      expect(AssignmentCommandSchema.parse({ command }).command).toBe(command);
    }
  });
});
