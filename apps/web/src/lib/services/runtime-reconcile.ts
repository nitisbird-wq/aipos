import { nowIso } from "@/lib/ids";
import type { MissionControlState, WorkstreamState } from "@/lib/schemas/contracts";
import {
  getMissionControlState,
  upsertMissionControlState,
} from "@/lib/services/control-plane-state";

export type ExternalActionEvidence = {
  action: "linear.search" | "linear.create" | "linear.repair" | "worker.handoff" | "other";
  correlation_id?: string;
  external_id?: string | null;
  workstream_id?: string;
  ok: boolean;
  detail: string;
  at?: string;
};

/**
 * Reconcile canonical runtime state after an external action.
 * Postgres/control-plane remains SoT — this only repairs/records divergence.
 *
 * Idempotency: when `evidence.correlation_id` is provided and `evidence.ok=false`,
 * a second call with the same correlation_id returns the existing state unchanged —
 * no duplicate blockers, audit events, or external actions are created.
 * The correlation_id is embedded as `[corr:<id>]` in the blocker detail for lookup.
 */
export async function reconcileRuntimeAfterExternalAction(input: {
  missionId: string;
  actor: string;
  evidence: ExternalActionEvidence;
  workstreamPatch?: Partial<WorkstreamState> & { workstream_id: string };
}): Promise<MissionControlState> {
  const state = await getMissionControlState(input.missionId);
  const at = input.evidence.at ?? nowIso();

  // Idempotency guard — same correlation_id on ok=false must not create duplicate blockers.
  if (!input.evidence.ok && input.evidence.correlation_id) {
    const corrTag = `[corr:${input.evidence.correlation_id}]`;
    const alreadyReconciled = state.blockers.some((b) => b.detail.includes(corrTag));
    if (alreadyReconciled) {
      return state;
    }
  }

  let workstreams = state.workstreams;

  if (input.workstreamPatch) {
    const id = input.workstreamPatch.workstream_id;
    workstreams = workstreams.map((row) =>
      row.workstream_id === id ? { ...row, ...input.workstreamPatch, updated_at: at } : row,
    );
  }

  const corrTag = input.evidence.correlation_id ? ` [corr:${input.evidence.correlation_id}]` : "";

  const blockers = input.evidence.ok
    ? state.blockers
    : [
        ...state.blockers,
        {
          mission_id: input.missionId,
          workstream_id: input.evidence.workstream_id ?? null,
          code: "EXTERNAL_ACTION_FAILED",
          detail: `${input.evidence.action}: ${input.evidence.detail}${corrTag}`,
          requires_human: false,
          opened_at: at,
          resolved: false,
        },
      ];

  return upsertMissionControlState(input.missionId, input.actor, {
    workstreams,
    blockers,
    updated_at: at,
    next_action: input.evidence.ok
      ? state.next_action
      : `Reconcile failed external action (${input.evidence.action})`,
    responsible: input.evidence.ok ? state.responsible : "dispatcher",
    mission_state: input.evidence.ok ? state.mission_state : "BLOCKED",
  });
}
