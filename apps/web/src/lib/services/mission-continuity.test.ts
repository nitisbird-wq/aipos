import { describe, expect, it } from "vitest";
import { checkpointPrimaryMissionForInterruption } from "@/lib/services/mission-continuity";

describe("primary mission continuity contract", () => {
  it("preserves the primary mission checkpoint and exact return action across an interruption", () => {
    const checkpoint = checkpointPrimaryMissionForInterruption({
      primary: {
        mission_id: "MIS-PRIMARY-1",
        objective: "Verify PR #21 before live execution",
        checkpoint: "Stage 0 corrective gates verified",
        next_action: "Start Stage 1 Blueprint contract",
        definition_of_done: "All approved stages pass with evidence",
      },
      interruption_id: "INT-1",
      kind: "RELATED_IDEA",
      summary: "Capture a follow-up dashboard idea",
    });

    expect(checkpoint.status).toBe("CHECKPOINTED");
    expect(checkpoint.primary.mission_id).toBe("MIS-PRIMARY-1");
    expect(checkpoint.return_to).toEqual({
      mission_id: "MIS-PRIMARY-1",
      checkpoint: "Stage 0 corrective gates verified",
      next_action: "Start Stage 1 Blueprint contract",
    });
    expect(checkpoint.interruption.kind).toBe("RELATED_IDEA");
  });

  it("fails closed when the return checkpoint is incomplete", () => {
    expect(() =>
      checkpointPrimaryMissionForInterruption({
        primary: {
          mission_id: "MIS-PRIMARY-1",
          objective: "Continue mission",
          checkpoint: "",
          next_action: "Resume",
          definition_of_done: "Done",
        },
        interruption_id: "INT-2",
        kind: "SUBTASK",
        summary: "Temporary subtask",
      }),
    ).toThrow("INVALID_INTERRUPTION_CHECKPOINT");
  });
});
