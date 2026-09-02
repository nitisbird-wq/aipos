import { getRepository } from "@/lib/repositories";
import { assertOperatorActor, newAuditId, newCorrelationId, nowIso } from "@/lib/ids";
import {
  MissionForecastSchema,
  ScopeLedgerItemSchema,
  type MissionForecast,
  type ScopeLedgerItem,
} from "@/lib/schemas/scope-guard";

const SCOPE_ACTIONS = new Set(["scope_guard:classified", "scope_guard:approved"]);

// prettier-ignore
function scopeFromEvent(event: { action: string; policy_result: unknown }) {
  if (!SCOPE_ACTIONS.has(event.action)) return null;
  const row = (event.policy_result as { scope_item?: unknown }).scope_item;
  return row ? ScopeLedgerItemSchema.parse(row) : null;
}

// prettier-ignore
export async function listScopeLedger(missionId: string): Promise<ScopeLedgerItem[]> {
  const audit = await getRepository().listAudit({ mission_id: missionId });
  const latest = new Map<string, ScopeLedgerItem>();
  for (const item of audit
    .map(scopeFromEvent)
    .filter((row): row is ScopeLedgerItem => Boolean(row))
    .sort((a, b) => b.created_at.localeCompare(a.created_at))) {
    if (!latest.has(item.scope_item_id)) latest.set(item.scope_item_id, item);
  }
  return Array.from(latest.values()).sort((a, b) => b.created_at.localeCompare(a.created_at));
}

// prettier-ignore
async function appendScope(item: ScopeLedgerItem, actor: string, action: string, reason: string) {
  const mission = await getRepository().getMissionById(item.mission_id);
  if (!mission) throw new Error("MISSION_NOT_FOUND");
  await getRepository().appendAudit({
    id: newAuditId(),
    aggregate_type: "mission",
    mission_id: item.mission_id,
    intake_id: mission.source_intake_id,
    actor,
    action,
    reason,
    correlation_id: newCorrelationId(),
    causation_id: null,
    previous_state: null,
    new_state: item.status,
    policy_result: { decision: "allow", scope_item: item },
    created_at: nowIso(),
  });
}

// prettier-ignore
export async function registerScopeItem(input: {
  missionId: string;
  title: string;
  description: string;
  classification: ScopeLedgerItem["classification"];
  required_for_dod: boolean;
  safety_required: boolean;
  rationale: string;
  value: string;
  trigger?: string | null;
  review_due_at?: string | null;
  material_impact: ScopeLedgerItem["material_impact"];
  wip_limit?: number;
  actor: string;
}) {
  assertOperatorActor(input.actor);
  if (!(await getRepository().getMissionById(input.missionId))) throw new Error("MISSION_NOT_FOUND");
  if (input.classification === "MUST_NOW" && !input.required_for_dod && !input.safety_required) {
    throw new Error("MUST_NOW_REQUIRES_DOD_OR_SAFETY");
  }
  const ledger = await listScopeLedger(input.missionId);
  const activeNow = ledger.filter(
    (item) => item.classification === "MUST_NOW" && item.status === "ACTIVE",
  ).length;
  if (
    input.classification === "MUST_NOW" &&
    activeNow >= (input.wip_limit ?? 2) &&
    !input.safety_required
  ) {
    throw new Error("WIP_LIMIT_REACHED");
  }
  const material = Object.entries(input.material_impact)
    .filter(([key]) => key !== "detail")
    .some(([, value]) => value === true);
  const createdAt = nowIso();
  const scopeItemId = `SCOPE-${input.missionId}-${ledger.length + 1}`;
  const item = ScopeLedgerItemSchema.parse({
    scope_version: "scope-guard.v1",
    scope_item_id: scopeItemId,
    mission_id: input.missionId,
    title: input.title,
    description: input.description,
    classification: input.classification,
    required_for_dod: input.required_for_dod,
    safety_required: input.safety_required,
    rationale: input.rationale,
    value: input.value,
    trigger: input.trigger ?? null,
    review_due_at: input.review_due_at ?? null,
    material_impact: input.material_impact,
    approval_status: material ? "REQUIRED" : "NOT_REQUIRED",
    status:
      input.classification === "REJECT"
        ? "REJECTED"
        : input.classification === "MUST_NOW" && !material
          ? "ACTIVE"
          : "PARKED",
    created_at: createdAt,
    created_by: input.actor,
    approved_at: null,
    approved_by: null,
  });
  await appendScope(item, input.actor, "scope_guard:classified", input.rationale);
  return item;
}

// prettier-ignore
export async function approveMaterialScopeChange(input: {
  missionId: string;
  scopeItemId: string;
  tradeoff: string;
  actor: string;
}) {
  assertOperatorActor(input.actor);
  const previous = (await listScopeLedger(input.missionId)).find(
    (item) => item.scope_item_id === input.scopeItemId,
  );
  if (!previous) throw new Error("SCOPE_ITEM_NOT_FOUND");
  if (previous.approval_status !== "REQUIRED") throw new Error("SCOPE_APPROVAL_NOT_REQUIRED");
  const now = nowIso();
  const approved = ScopeLedgerItemSchema.parse({
    ...previous,
    approval_status: "APPROVED",
    status: previous.classification === "MUST_NOW" ? "ACTIVE" : "PARKED",
    rationale: `${previous.rationale}; approved trade-off: ${input.tradeoff}`,
    approved_at: now,
    approved_by: input.actor,
  });
  await appendScope(
    approved,
    input.actor,
    "scope_guard:approved",
    `Material scope trade-off approved: ${input.tradeoff}`,
  );
  return approved;
}

// prettier-ignore
export function calculateMissionForecast(input: {
  missionId: string;
  stages: Array<{
    stage_id: string;
    min_hours: number;
    max_hours: number;
    assumption: string;
  }>;
}): MissionForecast {
  if (input.stages.some((stage) => stage.max_hours < stage.min_hours)) {
    throw new Error("INVALID_FORECAST_RANGE");
  }
  return MissionForecastSchema.parse({
    forecast_version: "mission-forecast.v1",
    mission_id: input.missionId,
    min_effort_hours: input.stages.reduce((total, stage) => total + stage.min_hours, 0),
    max_effort_hours: input.stages.reduce((total, stage) => total + stage.max_hours, 0),
    assumptions: input.stages.map((stage) => `${stage.stage_id}: ${stage.assumption}`),
    stage_ranges: input.stages,
    calculated_at: nowIso(),
  });
}
