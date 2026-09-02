import { getRepository } from "@/lib/repositories";
import { assertOperatorActor, newAuditId, newCorrelationId, nowIso } from "@/lib/ids";
import {
  MissionBlueprintSchema,
  MissionStageSchema,
  type MissionBlueprint,
  type MissionStage,
} from "@/lib/schemas/mission-blueprint";

function blueprintFromEvent(event: { action: string; policy_result: unknown }) {
  if (!["mission_blueprint:revision", "mission_blueprint:approved"].includes(event.action)) {
    return null;
  }
  const row = (event.policy_result as { blueprint?: unknown }).blueprint;
  if (!row) return null;
  return MissionBlueprintSchema.parse(row);
}

function validateStageGraph(stages: MissionStage[], criticalPath: string[]) {
  const stageIds = new Set(stages.map((stage) => stage.stage_id));
  if (stageIds.size !== stages.length) throw new Error("DUPLICATE_STAGE_ID");

  const orders = new Set(stages.map((stage) => stage.order));
  if (orders.size !== stages.length) throw new Error("DUPLICATE_STAGE_ORDER");

  for (const stage of stages) {
    if (stage.dependencies.some((dependency) => !stageIds.has(dependency))) {
      throw new Error("UNKNOWN_STAGE_DEPENDENCY");
    }
  }
  if (criticalPath.some((stageId) => !stageIds.has(stageId))) {
    throw new Error("UNKNOWN_CRITICAL_PATH_STAGE");
  }
}

export function computeBlueprintProgress(stages: MissionStage[]) {
  const completed = stages.filter((stage) => stage.status === "COMPLETED");
  if (completed.some((stage) => stage.evidence_refs.length === 0)) {
    throw new Error("COMPLETED_STAGE_REQUIRES_EVIDENCE");
  }
  const evidenceRefs = Array.from(new Set(completed.flatMap((stage) => stage.evidence_refs)));
  return {
    completed_stages: completed.length,
    total_stages: stages.length,
    percent: Math.round((completed.length / stages.length) * 100),
    evidence_refs: evidenceRefs,
  };
}

export async function listMissionBlueprints(missionId: string): Promise<MissionBlueprint[]> {
  const repo = getRepository();
  const mission = await repo.getMissionById(missionId);
  if (!mission) throw new Error("MISSION_NOT_FOUND");
  const audit = await repo.listAudit({ mission_id: missionId });
  return audit
    .map(blueprintFromEvent)
    .filter((row): row is MissionBlueprint => Boolean(row))
    .sort((a, b) => b.revision - a.revision || b.created_at.localeCompare(a.created_at));
}

export async function getLatestMissionBlueprint(
  missionId: string,
): Promise<MissionBlueprint | null> {
  return (await listMissionBlueprints(missionId))[0] ?? null;
}

export async function getApprovedMissionBlueprint(
  missionId: string,
): Promise<MissionBlueprint | null> {
  const latest = await getLatestMissionBlueprint(missionId);
  return latest?.status === "APPROVED" ? latest : null;
}

export async function saveMissionBlueprint(input: {
  missionId: string;
  actor: string;
  final_outcome: string;
  definition_of_done: string;
  stages: MissionStage[];
  critical_path: string[];
  next_action: string;
}): Promise<MissionBlueprint> {
  const repo = getRepository();
  const mission = await repo.getMissionById(input.missionId);
  if (!mission) throw new Error("MISSION_NOT_FOUND");

  const stages = input.stages.map((stage) => MissionStageSchema.parse(stage));
  validateStageGraph(stages, input.critical_path);
  const previous = await getLatestMissionBlueprint(input.missionId);
  const revision = (previous?.revision ?? 0) + 1;
  const now = nowIso();
  const blueprint = MissionBlueprintSchema.parse({
    blueprint_version: "mission-blueprint.v1",
    blueprint_id: `BP-${input.missionId}-R${revision}`,
    mission_id: input.missionId,
    revision,
    status: "IN_REVIEW",
    final_outcome: input.final_outcome,
    definition_of_done: input.definition_of_done,
    stages,
    critical_path: input.critical_path,
    progress: computeBlueprintProgress(stages),
    next_action: input.next_action,
    supersedes_revision: previous?.revision ?? null,
    created_at: now,
    created_by: input.actor,
    approved_at: null,
    approved_by: null,
  });

  await repo.appendAudit({
    id: newAuditId(),
    aggregate_type: "mission",
    mission_id: input.missionId,
    intake_id: mission.source_intake_id,
    actor: input.actor,
    action: "mission_blueprint:revision",
    reason: `Mission Blueprint revision ${revision} saved for review`,
    correlation_id: newCorrelationId(),
    causation_id: null,
    previous_state: previous?.status ?? null,
    new_state: "IN_REVIEW",
    policy_result: { decision: "allow", blueprint },
    created_at: now,
  });
  return blueprint;
}

export async function approveMissionBlueprint(input: {
  missionId: string;
  revision: number;
  actor: string;
}): Promise<MissionBlueprint> {
  assertOperatorActor(input.actor);
  const repo = getRepository();
  const latest = await getLatestMissionBlueprint(input.missionId);
  if (!latest) throw new Error("BLUEPRINT_NOT_FOUND");
  if (latest.revision !== input.revision) throw new Error("STALE_BLUEPRINT_REVISION");

  const now = nowIso();
  const approved = MissionBlueprintSchema.parse({
    ...latest,
    status: "APPROVED",
    approved_at: now,
    approved_by: input.actor,
  });
  const mission = await repo.getMissionById(input.missionId);
  if (!mission) throw new Error("MISSION_NOT_FOUND");

  await repo.appendAudit({
    id: newAuditId(),
    aggregate_type: "mission",
    mission_id: input.missionId,
    intake_id: mission.source_intake_id,
    actor: input.actor,
    action: "mission_blueprint:approved",
    reason: `Mission Blueprint revision ${input.revision} approved`,
    correlation_id: newCorrelationId(),
    causation_id: null,
    previous_state: latest.status,
    new_state: "APPROVED",
    policy_result: { decision: "allow", blueprint: approved },
    created_at: now,
  });
  return approved;
}
