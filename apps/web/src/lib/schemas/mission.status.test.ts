import { describe, expect, it } from "vitest";
import { MissionObjectSchema, MissionStatusSchema } from "@/lib/schemas/mission";

const baseMission = {
  mission_id: "MIS-1",
  object_version: "1.0" as const,
  revision: 1,
  source_intake_id: "INT-1",
  source_intake_version: "1",
  mapping_version: "1.0" as const,
  status: "ready" as const,
  planning_status: "not_started" as const,
  planning_revision: 0,
  last_planned_at: null,
  planning_reason: null,
  criticality: "normal" as const,
  subtask_ids: [],
  current_blockers: [],
  approval_policy_refs: [],
  anticipated_approval_points: [],
  evidence_refs: [],
};

describe("MissionStatusSchema — ADR-005 D-005.3 coarse status", () => {
  it("accepts the new Phase 3a coarse states alongside MVP states", () => {
    for (const status of [
      "draft",
      "ready",
      "understanding",
      "active",
      "blocked",
      "cancelled",
      "closed",
    ]) {
      expect(MissionStatusSchema.parse(status)).toBe(status);
    }
  });

  it("rejects an unknown status", () => {
    expect(() => MissionStatusSchema.parse("in_progress")).toThrow();
  });
});

describe("MissionObjectSchema — status_before_block (ADR-005 §5)", () => {
  it("defaults to omittable/nullable without breaking existing MVP missions", () => {
    expect(MissionObjectSchema.parse(baseMission).status_before_block).toBeUndefined();
  });

  it("accepts a previous coarse status while blocked", () => {
    const blocked = {
      ...baseMission,
      status: "blocked" as const,
      status_before_block: "active" as const,
    };
    expect(MissionObjectSchema.parse(blocked).status_before_block).toBe("active");
  });

  it("accepts null once unblocked and cleared", () => {
    const cleared = { ...baseMission, status_before_block: null };
    expect(MissionObjectSchema.parse(cleared).status_before_block).toBeNull();
  });
});
