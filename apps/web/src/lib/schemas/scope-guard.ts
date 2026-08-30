import { z } from "zod";

export const ScopeClassificationSchema = z.enum([
  "MUST_NOW",
  "SHOULD_NEXT",
  "LATER",
  "REJECT",
]);

export const ScopeLedgerItemSchema = z.object({
  scope_version: z.literal("scope-guard.v1"),
  scope_item_id: z.string().min(1),
  mission_id: z.string().min(1),
  title: z.string().min(1),
  description: z.string().min(1),
  classification: ScopeClassificationSchema,
  required_for_dod: z.boolean(),
  safety_required: z.boolean(),
  rationale: z.string().min(1),
  value: z.string().min(1),
  trigger: z.string().min(1).nullable(),
  review_due_at: z.string().datetime().nullable(),
  material_impact: z.object({
    time: z.boolean(),
    cost: z.boolean(),
    risk: z.boolean(),
    architecture: z.boolean(),
    detail: z.string().min(1).nullable(),
  }),
  approval_status: z.enum(["NOT_REQUIRED", "REQUIRED", "APPROVED"]),
  status: z.enum(["ACTIVE", "PARKED", "REJECTED"]),
  created_at: z.string().datetime(),
  created_by: z.string().min(1),
  approved_at: z.string().datetime().nullable(),
  approved_by: z.string().min(1).nullable(),
});

export type ScopeClassification = z.infer<typeof ScopeClassificationSchema>;
export type ScopeLedgerItem = z.infer<typeof ScopeLedgerItemSchema>;

export const MissionForecastSchema = z.object({
  forecast_version: z.literal("mission-forecast.v1"),
  mission_id: z.string().min(1),
  min_effort_hours: z.number().min(0),
  max_effort_hours: z.number().min(0),
  assumptions: z.array(z.string()).min(1),
  stage_ranges: z.array(
    z.object({
      stage_id: z.string().min(1),
      min_hours: z.number().min(0),
      max_hours: z.number().min(0),
      assumption: z.string().min(1),
    }),
  ),
  calculated_at: z.string().datetime(),
});

export type MissionForecast = z.infer<typeof MissionForecastSchema>;
