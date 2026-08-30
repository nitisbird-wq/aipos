import { z } from "zod";

export const MissionCheckpointSchema = z.object({
  checkpoint_id: z.string().min(1),
  mission_id: z.string().min(1),
  summary: z.string().min(1),
  completed_outputs: z.array(z.string()),
  next_action: z.string().min(1),
  blockers: z.array(z.string()),
  idempotency_key: z.string().min(1),
  created_at: z.string().datetime(),
});

export const MissionInterruptionSchema = z.object({
  interruption_id: z.string().min(1),
  interrupted_mission_id: z.string().min(1),
  interruption_mission_id: z.string().min(1),
  classification: z.enum(["RELATED_IDEA", "SUBTASK", "URGENT_INTERRUPTION", "NEW_MISSION"]),
  reason: z.string().min(1),
  checkpoint_id: z.string().min(1),
  opened_at: z.string().datetime(),
});

export const MissionNavigationStateSchema = z.object({
  navigation_version: z.literal("mission-navigation.v1"),
  workspace_id: z.string().min(1),
  revision: z.number().int().positive(),
  primary_mission_id: z.string().min(1),
  active_mission_id: z.string().min(1),
  primary_objective: z.string().min(1),
  definition_of_done: z.string().min(1),
  checkpoint: MissionCheckpointSchema,
  interruption_stack: z.array(MissionInterruptionSchema),
  updated_at: z.string().datetime(),
  updated_by: z.string().min(1),
});

export type MissionCheckpoint = z.infer<typeof MissionCheckpointSchema>;
export type MissionInterruption = z.infer<typeof MissionInterruptionSchema>;
export type MissionNavigationState = z.infer<typeof MissionNavigationStateSchema>;
