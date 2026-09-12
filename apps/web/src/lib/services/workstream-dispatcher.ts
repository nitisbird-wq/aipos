import { nowIso } from "@/lib/ids";
import type { OutcomeWorkstream, WorkstreamState } from "@/lib/schemas/contracts";
import {
  getMissionControlState,
  upsertMissionControlState,
} from "@/lib/services/control-plane-state";
import { reconcileRuntimeAfterExternalAction } from "@/lib/services/runtime-reconcile";

export type LinearDispatchAdapter = {
  searchByCorrelationId: (correlationId: string) => Promise<{ id: string; title: string } | null>;
  createWorkstreamIssue: (input: {
    correlationId: string;
    title: string;
    body: string;
  }) => Promise<{ id: string; title: string }>;
};

export type DispatchResult = {
  mission_id: string;
  dispatched: Array<{ workstream_id: string; linear_issue_id: string; reused: boolean }>;
  repaired: Array<{ workstream_id: string; linear_issue_id: string; reason: string }>;
  blocked: Array<{ workstream_id: string; reason: string }>;
};

function correlationIdFor(missionId: string, workstreamId: string): string {
  return `DSP-${missionId}-${workstreamId}`;
}

/**
 * Idempotent dispatcher: search by exact correlation ID before create.
 * Fail closed when search fails. Repair write-back when external create succeeds.
 */
export async function dispatchWorkstreams(input: {
  missionId: string;
  workstreams: OutcomeWorkstream[];
  adapter: LinearDispatchAdapter;
  actor: string;
}): Promise<DispatchResult> {
  const state = await getMissionControlState(input.missionId);
  const dispatched: DispatchResult["dispatched"] = [];
  const repaired: DispatchResult["repaired"] = [];
  const blocked: DispatchResult["blocked"] = [];
  const nextRows: WorkstreamState[] = [...state.workstreams];

  for (const stream of input.workstreams) {
    const correlationId = correlationIdFor(input.missionId, stream.workstream_id);
    let existing = nextRows.find((row) => row.workstream_id === stream.workstream_id);
    if (!existing) {
      nextRows.push({
        mission_id: input.missionId,
        workstream_id: stream.workstream_id,
        correlation_id: correlationId,
        title: stream.title,
        objective: stream.objective,
        status: "PENDING",
        owner: "dispatcher",
        linear_issue_id: null,
        dependencies: stream.dependencies,
        expected_output: stream.expected_output,
        required_capabilities: stream.required_capabilities,
        risk_level: stream.risk_level,
        approval_required: stream.approval_required,
        updated_at: nowIso(),
      });
      existing = nextRows[nextRows.length - 1]!;
    }

    if (existing.linear_issue_id && existing.status === "DISPATCHED") {
      dispatched.push({
        workstream_id: stream.workstream_id,
        linear_issue_id: existing.linear_issue_id,
        reused: true,
      });
      continue;
    }

    let found: { id: string; title: string } | null = null;
    try {
      found = await input.adapter.searchByCorrelationId(correlationId);
    } catch {
      blocked.push({
        workstream_id: stream.workstream_id,
        reason: "Search failed; dispatcher fail-closed before create",
      });
      existing.status = "BLOCKED";
      existing.updated_at = nowIso();
      await reconcileRuntimeAfterExternalAction({
        missionId: input.missionId,
        actor: input.actor,
        evidence: {
          action: "linear.search",
          correlation_id: correlationId,
          workstream_id: stream.workstream_id,
          ok: false,
          detail: "Search failed; fail-closed before create",
        },
        workstreamPatch: {
          workstream_id: stream.workstream_id,
          status: "BLOCKED",
        },
      });
      continue;
    }

    if (!found) {
      try {
        found = await input.adapter.createWorkstreamIssue({
          correlationId,
          title: stream.title,
          body: `${stream.objective}\n\ncorrelation_id=${correlationId}`,
        });
      } catch (err) {
        blocked.push({
          workstream_id: stream.workstream_id,
          reason: `Create failed: ${err instanceof Error ? err.message : "unknown"}`,
        });
        existing.status = "BLOCKED";
        existing.updated_at = nowIso();
        continue;
      }
    }

    try {
      existing.linear_issue_id = found.id;
      existing.status = "DISPATCHED";
      existing.updated_at = nowIso();
      dispatched.push({
        workstream_id: stream.workstream_id,
        linear_issue_id: found.id,
        reused: false,
      });
      await reconcileRuntimeAfterExternalAction({
        missionId: input.missionId,
        actor: input.actor,
        evidence: {
          action: "linear.create",
          correlation_id: correlationId,
          external_id: found.id,
          workstream_id: stream.workstream_id,
          ok: true,
          detail: "External issue mapped and write-back applied",
        },
        workstreamPatch: {
          workstream_id: stream.workstream_id,
          linear_issue_id: found.id,
          status: "DISPATCHED",
        },
      });
    } catch {
      repaired.push({
        workstream_id: stream.workstream_id,
        linear_issue_id: found.id,
        reason: "External create succeeded but write-back failed; repair required",
      });
    }
  }

  const blockers = [
    ...state.blockers.filter((b) => b.code !== "DISPATCH_SEARCH_FAILED" || b.resolved),
    ...blocked.map((entry) => ({
      mission_id: input.missionId,
      workstream_id: entry.workstream_id,
      code: "DISPATCH_SEARCH_FAILED",
      detail: entry.reason,
      requires_human: false,
      opened_at: nowIso(),
      resolved: false,
    })),
  ];

  await upsertMissionControlState(input.missionId, input.actor, {
    workstreams: nextRows,
    blockers,
    mission_state: blocked.length > 0 ? "BLOCKED" : "DISPATCHED",
    next_action:
      blocked.length > 0 ? "Reconcile blocked dispatch searches" : "Prepare worker-ready packages",
    responsible: blocked.length > 0 ? "dispatcher" : "supervisor",
    updated_at: nowIso(),
  });

  return {
    mission_id: input.missionId,
    dispatched,
    repaired,
    blocked,
  };
}

/**
 * Repair state when external create succeeded but local write-back failed.
 */
export async function repairDispatchWriteback(input: {
  missionId: string;
  workstreamId: string;
  linearIssueId: string;
  actor: string;
}): Promise<WorkstreamState | null> {
  const state = await getMissionControlState(input.missionId);
  const nextRows = state.workstreams.map((row) =>
    row.workstream_id === input.workstreamId
      ? {
          ...row,
          linear_issue_id: input.linearIssueId,
          status: "DISPATCHED" as const,
          updated_at: nowIso(),
        }
      : row,
  );
  await upsertMissionControlState(input.missionId, input.actor, {
    workstreams: nextRows,
    mission_state: "DISPATCHED",
    next_action: "Prepare worker-ready packages",
    responsible: "supervisor",
    updated_at: nowIso(),
  });
  await reconcileRuntimeAfterExternalAction({
    missionId: input.missionId,
    actor: input.actor,
    evidence: {
      action: "linear.repair",
      external_id: input.linearIssueId,
      workstream_id: input.workstreamId,
      ok: true,
      detail: "Repaired local write-back after external create",
    },
    workstreamPatch: {
      workstream_id: input.workstreamId,
      linear_issue_id: input.linearIssueId,
      status: "DISPATCHED",
    },
  });
  return nextRows.find((row) => row.workstream_id === input.workstreamId) ?? null;
}
