import { z } from "zod";

// Architecture Contract §§4,6: edit understanding, never identity or authority.
const text = z.string().trim().min(1).max(20000);
export const DraftCorrectionSchema = z
  .object({
    intake_id: z.string().regex(/^INT-/),
    expected_updated_at: z.string().min(1),
    mission_summary: text,
    desired_outcome: text,
    success_criteria: z.array(text).min(1).max(50),
    constraints: z.array(text).max(100),
    workstreams: z
      .array(
        z
          .object({
            id: z.string().regex(/^WS/),
            name: text,
            purpose: text,
            expected_outputs: z.array(text).min(1).max(50),
          })
          .strict(),
      )
      .min(1)
      .max(50),
  })
  .strict()
  .refine((v) => new Set(v.workstreams.map((w) => w.id)).size === v.workstreams.length, {
    message: "Workstream IDs must be unique",
  });
export type DraftCorrection = z.infer<typeof DraftCorrectionSchema>;
