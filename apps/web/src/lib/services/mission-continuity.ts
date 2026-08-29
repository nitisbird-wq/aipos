export type InterruptionKind =
  | "RELATED_IDEA"
  | "SUBTASK"
  | "URGENT_INTERRUPTION"
  | "NEW_MISSION";

export type PrimaryMissionAnchor = {
  mission_id: string;
  objective: string;
  checkpoint: string;
  next_action: string;
  definition_of_done: string;
};

export type InterruptionCheckpoint = {
  checkpoint_version: "interruption-checkpoint.v1";
  status: "CHECKPOINTED";
  primary: PrimaryMissionAnchor;
  interruption: {
    interruption_id: string;
    kind: InterruptionKind;
    summary: string;
  };
  return_to: {
    mission_id: string;
    checkpoint: string;
    next_action: string;
  };
};

/**
 * Contract-only Stage 0 checkpoint.
 *
 * It proves that an interruption payload cannot silently replace the primary
 * mission anchor. Persistence, nested stacks, stale supervision and automatic
 * runtime resume remain Stage 5 work.
 */
export function checkpointPrimaryMissionForInterruption(input: {
  primary: PrimaryMissionAnchor;
  interruption_id: string;
  kind: InterruptionKind;
  summary: string;
}): InterruptionCheckpoint {
  const required = [
    input.primary.mission_id,
    input.primary.objective,
    input.primary.checkpoint,
    input.primary.next_action,
    input.primary.definition_of_done,
    input.interruption_id,
    input.summary,
  ];
  if (required.some((value) => !value.trim())) {
    throw new Error("INVALID_INTERRUPTION_CHECKPOINT");
  }

  return {
    checkpoint_version: "interruption-checkpoint.v1",
    status: "CHECKPOINTED",
    primary: { ...input.primary },
    interruption: {
      interruption_id: input.interruption_id,
      kind: input.kind,
      summary: input.summary,
    },
    return_to: {
      mission_id: input.primary.mission_id,
      checkpoint: input.primary.checkpoint,
      next_action: input.primary.next_action,
    },
  };
}
