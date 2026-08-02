import type { MissionObject, MissionStatus, TransitionCommand } from "@/lib/schemas/mission";
import { canonicalizeTransitionCommand } from "@/lib/schemas/mission";
import { getRepository } from "@/lib/repositories";
import { newAuditId, newCorrelationId, nowIso } from "@/lib/ids";
import { TRANSITION_ALLOWED } from "@/lib/services/transition-rules";
import { invalidateNotionVerificationIfStale } from "@/lib/services/notion-sync-service";

export type TransitionResult =
  | { ok: true; mission: MissionObject; correlation_id: string }
  | { ok: false; code: "INVALID_TRANSITION"; message: string };

/**
 * Transition command service — no direct PATCH of mission status.
 * Server-side validation remains authoritative.
 * Bumping revision invalidates Notion verification when source_record_version diverges.
 */
export async function applyMissionTransition(params: {
  missionId: string;
  command: TransitionCommand["command"];
  reason: string;
  actor: string;
  correlation_id?: string;
  causation_id?: string;
}): Promise<TransitionResult> {
  const repo = getRepository();
  const mission = await repo.getMissionById(params.missionId);
  if (!mission) {
    return { ok: false, code: "INVALID_TRANSITION", message: "Mission not found" };
  }

  const command = canonicalizeTransitionCommand(params.command);
  const next = TRANSITION_ALLOWED[mission.status as MissionStatus]?.[command];
  if (!next) {
    return {
      ok: false,
      code: "INVALID_TRANSITION",
      message: `Command '${command}' is not allowed from status '${mission.status}'`,
    };
  }

  const previous = mission.status;
  const updated: MissionObject = {
    ...mission,
    status: next,
    revision: mission.revision + 1,
  };

  const correlation_id = params.correlation_id || newCorrelationId();
  await repo.saveMission(updated);
  await invalidateNotionVerificationIfStale(updated);

  await repo.appendAudit({
    id: newAuditId(),
    aggregate_type: "mission",
    mission_id: mission.mission_id,
    intake_id: mission.source_intake_id,
    actor: params.actor,
    action: `transition:${command}`,
    reason: params.reason,
    correlation_id,
    causation_id: params.causation_id ?? null,
    previous_state: previous,
    new_state: next,
    policy_result: {
      decision: "allow",
      gate: "transition",
      policy_ref: "AIPOS-GOV-003",
      allowed: true,
      command,
    },
    created_at: nowIso(),
  });

  return { ok: true, mission: updated, correlation_id };
}
