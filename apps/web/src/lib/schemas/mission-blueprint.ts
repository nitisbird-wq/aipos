import { z } from "zod";

export const MissionStageStatusSchema = z.enum([
  "PLANNED",
  "READY",
  "IN_PROGRESS",
  "BLOCKED",
  "VERIFYING",
  "COMPLETED",
  "CANCELLED",
]);

export const MissionStageSchema = z.object({
  stage_id: z.string().min(1),
  order: z.number().int().positive(),
  title: z.string().min(1),
  objective: z.string().min(1),
  outputs: z.array(z.string()).min(1),
  dependencies: z.array(z.string()),
  entry_criteria: z.array(z.string()).min(1),
  exit_criteria: z.array(z.string()).min(1),
  owner: z.string().min(1),
  status: MissionStageStatusSchema,
  evidence_refs: z.array(z.string()),
});

export const MissionBlueprintSchema = z.object({
  blueprint_version: z.literal("mission-blueprint.v1"),
  blueprint_id: z.string().min(1),
  mission_id: z.string().min(1),
  revision: z.number().int().positive(),
  status: z.enum(["DRAFT", "IN_REVIEW", "APPROVED", "SUPERSEDED"]),
  final_outcome: z.string().min(1),
  definition_of_done: z.string().min(1),
  stages: z.array(MissionStageSchema).min(1),
  critical_path: z.array(z.string()).min(1),
  progress: z.object({
    completed_stages: z.number().int().min(0),
    total_stages: z.number().int().positive(),
    percent: z.number().min(0).max(100),
    evidence_refs: z.array(z.string()),
  }),
  next_action: z.string().min(1),
  supersedes_revision: z.number().int().positive().nullable(),
  created_at: z.string().datetime(),
  created_by: z.string().min(1),
  approved_at: z.string().datetime().nullable(),
  approved_by: z.string().min(1).nullable(),
});

export type MissionStage = z.infer<typeof MissionStageSchema>;
export type MissionBlueprint = z.infer<typeof MissionBlueprintSchema>;
