import { getRepository } from "@/lib/repositories";
import { assertOperatorActor, newAuditId, newCorrelationId, nowIso } from "@/lib/ids";
import {
  MissionCheckpointSchema,
  MissionNavigationStateSchema,
  type MissionCheckpoint,
  type MissionNavigationState,
} from "@/lib/schemas/mission-navigation";

const NAVIGATION_ACTION = "mission_navigation:snapshot";

// prettier-ignore
function navigationFromEvent(event: { action: string; policy_result: unknown }) {
  if (event.action !== NAVIGATION_ACTION) return null;
  const row = (event.policy_result as { mission_navigation?: unknown }).mission_navigation;
  return row ? MissionNavigationStateSchema.parse(row) : null;
}

// prettier-ignore
async function listNavigationHistory(workspaceId: string) {
  const audit = await getRepository().listAudit({});
  return audit
    .map(navigationFromEvent)
    .filter((row): row is MissionNavigationState => Boolean(row))
    .filter((row) => row.workspace_id === workspaceId)
    .sort((a, b) => b.revision - a.revision || b.updated_at.localeCompare(a.updated_at));
}

// prettier-ignore
export async function getMissionNavigation(workspaceId: string) {
  return (await listNavigationHistory(workspaceId))[0] ?? null;
}

// prettier-ignore
async function assertMissionExists(missionId: string) {
  if (!(await getRepository().getMissionById(missionId))) throw new Error("MISSION_NOT_FOUND");
}

// prettier-ignore
async function persistNavigation(
  previous: MissionNavigationState | null,
  next: MissionNavigationState,
  reason: string,
) {
  await getRepository().appendAudit({
    id: newAuditId(),
    aggregate_type: "system",
    mission_id: next.active_mission_id,
    intake_id: null,
    actor: next.updated_by,
    action: NAVIGATION_ACTION,
    reason,
    correlation_id: newCorrelationId(),
    causation_id: null,
    previous_state: previous?.active_mission_id ?? null,
    new_state: next.active_mission_id,
    policy_result: { decision: "allow", mission_navigation: next },
    created_at: next.updated_at,
  });
  return next;
}

// prettier-ignore
function checkpoint(input: {
  missionId: string;
  summary: string;
  completedOutputs: string[];
  nextAction: string;
  blockers: string[];
  idempotencyKey: string;
}): MissionCheckpoint {
  return MissionCheckpointSchema.parse({
    checkpoint_id: `CHK-${input.missionId}-${input.idempotencyKey}`,
    mission_id: input.missionId,
    summary: input.summary,
    completed_outputs: input.completedOutputs,
    next_action: input.nextAction,
    blockers: input.blockers,
    idempotency_key: input.idempotencyKey,
    created_at: nowIso(),
  });
}

// prettier-ignore
export async function setPrimaryMission(input: {
  workspaceId: string;
  missionId: string;
  objective: string;
  definitionOfDone: string;
  nextAction: string;
  actor: string;
}) {
  assertOperatorActor(input.actor);
  await assertMissionExists(input.missionId);
  const previous = await getMissionNavigation(input.workspaceId);
  const updatedAt = nowIso();
  const next = MissionNavigationStateSchema.parse({
    navigation_version: "mission-navigation.v1",
    workspace_id: input.workspaceId,
    revision: (previous?.revision ?? 0) + 1,
    primary_mission_id: input.missionId,
    active_mission_id: input.missionId,
    primary_objective: input.objective,
    definition_of_done: input.definitionOfDone,
    checkpoint: checkpoint({
      missionId: input.missionId,
      summary: "Primary mission anchored",
      completedOutputs: [],
      nextAction: input.nextAction,
      blockers: [],
      idempotencyKey: `primary-${input.missionId}`,
    }),
    interruption_stack: [],
    updated_at: updatedAt,
    updated_by: input.actor,
  });
  return persistNavigation(previous, next, "Primary mission explicitly anchored");
}

// prettier-ignore
export async function checkpointActiveMission(input: {
  workspaceId: string;
  summary: string;
  completedOutputs: string[];
  nextAction: string;
  blockers: string[];
  idempotencyKey: string;
  actor: string;
}) {
  assertOperatorActor(input.actor);
  const previous = await getMissionNavigation(input.workspaceId);
  if (!previous) throw new Error("PRIMARY_MISSION_NOT_SET");
  const original = (await listNavigationHistory(input.workspaceId)).find(
    (row) => row.checkpoint.idempotency_key === input.idempotencyKey,
  );
  if (original) return original;
  const updatedAt = nowIso();
  const next = MissionNavigationStateSchema.parse({
    ...previous,
    revision: previous.revision + 1,
    checkpoint: checkpoint({
      missionId: previous.active_mission_id,
      summary: input.summary,
      completedOutputs: input.completedOutputs,
      nextAction: input.nextAction,
      blockers: input.blockers,
      idempotencyKey: input.idempotencyKey,
    }),
    updated_at: updatedAt,
    updated_by: input.actor,
  });
  return persistNavigation(previous, next, "Active mission checkpoint saved");
}

// prettier-ignore
export async function interruptMission(input: {
  workspaceId: string;
  interruptionMissionId: string;
  classification: "RELATED_IDEA" | "SUBTASK" | "URGENT_INTERRUPTION" | "NEW_MISSION";
  reason: string;
  interruptionNextAction: string;
  actor: string;
}) {
  assertOperatorActor(input.actor);
  await assertMissionExists(input.interruptionMissionId);
  const previous = await getMissionNavigation(input.workspaceId);
  if (!previous) throw new Error("PRIMARY_MISSION_NOT_SET");
  const updatedAt = nowIso();
  const interruptionId = `INT-${previous.revision + 1}-${input.interruptionMissionId}`;
  const next = MissionNavigationStateSchema.parse({
    ...previous,
    revision: previous.revision + 1,
    active_mission_id: input.interruptionMissionId,
    checkpoint: checkpoint({
      missionId: input.interruptionMissionId,
      summary: input.reason,
      completedOutputs: [],
      nextAction: input.interruptionNextAction,
      blockers: [],
      idempotencyKey: interruptionId,
    }),
    interruption_stack: [
      ...previous.interruption_stack,
      {
        interruption_id: interruptionId,
        interrupted_mission_id: previous.active_mission_id,
        interruption_mission_id: input.interruptionMissionId,
        classification: input.classification,
        reason: input.reason,
        return_checkpoint: previous.checkpoint,
        opened_at: updatedAt,
      },
    ],
    updated_at: updatedAt,
    updated_by: input.actor,
  });
  return persistNavigation(previous, next, "Interruption pushed after checkpoint");
}

// prettier-ignore
export async function resolveInterruption(input: {
  workspaceId: string;
  result: "COMPLETED" | "PARKED" | "BLOCKED" | "CANCELLED";
  summary: string;
  actor: string;
}) {
  assertOperatorActor(input.actor);
  const previous = await getMissionNavigation(input.workspaceId);
  if (!previous) throw new Error("PRIMARY_MISSION_NOT_SET");
  const top = previous.interruption_stack.at(-1);
  if (!top || top.interruption_mission_id !== previous.active_mission_id) {
    throw new Error("ACTIVE_INTERRUPTION_NOT_FOUND");
  }
  const updatedAt = nowIso();
  const next = MissionNavigationStateSchema.parse({
    ...previous,
    revision: previous.revision + 1,
    active_mission_id: top.interrupted_mission_id,
    checkpoint: top.return_checkpoint,
    interruption_stack: previous.interruption_stack.slice(0, -1),
    updated_at: updatedAt,
    updated_by: input.actor,
  });
  const state = await persistNavigation(
    previous,
    next,
    `Interruption ${input.result}: ${input.summary}; returned to prior mission`,
  );
  return {
    state,
    return_prompt: {
      interruption_result: input.result,
      interruption_summary: input.summary,
      mission_id: state.active_mission_id,
      checkpoint: state.checkpoint.summary,
      next_action: state.checkpoint.next_action,
    },
  };
}

// prettier-ignore
export async function resumeMission(workspaceId: string) {
  const state = await getMissionNavigation(workspaceId);
  if (!state) throw new Error("PRIMARY_MISSION_NOT_SET");
  return {
    mission_id: state.active_mission_id,
    checkpoint_id: state.checkpoint.checkpoint_id,
    completed_outputs: state.checkpoint.completed_outputs,
    next_action: state.checkpoint.next_action,
    blockers: state.checkpoint.blockers,
    idempotency_key: state.checkpoint.idempotency_key,
  };
}

// prettier-ignore
export function evaluateStaleMissionNavigation(
  state: MissionNavigationState,
  at = new Date(),
  staleHours = 24,
) {
  const ageHours = (at.getTime() - new Date(state.updated_at).getTime()) / 3_600_000;
  return {
    stale: ageHours >= staleHours,
    age_hours: Math.max(0, Math.round(ageHours * 10) / 10),
    threshold_hours: staleHours,
    reminder: ageHours >= staleHours
      ? `Resume ${state.active_mission_id}: ${state.checkpoint.next_action}`
      : null,
  };
}
