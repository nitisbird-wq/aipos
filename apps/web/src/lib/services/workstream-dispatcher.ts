import { nowIso } from "@/lib/ids";
import type { OutcomeWorkstream } from "@/lib/schemas/contracts";
import {
  getMissionControlState,
  upsertMissionControlState,
} from "@/lib/services/control-plane-state";

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
  dispatched: Array<{ workstream_id: string; linear_issue_id: string }>;
  repaired: Array<{ workstream_id: string; linear_issue_id: string; reason: string }>;
  blocked: Array<{ workstream_id: string; reason: string }>;
};

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
  const nextRows = [...state.workstreams];

  for (const stream of input.workstreams) {
    const correlationId = `DSP-${input.missionId}-${stream.workstream_id}`;
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
      existing = nextRows[nextRows.length - 1];
    }

    let found: { id: string; title: string } | null = null;
    try {
      found = await input.adapter.searchByCorrelationId(correlationId);
    } catch {
      blocked.push({
        workstream_id: stream.workstream_id,
        reason: "Search failed; dispatcher fail-closed before create",
      });
      continue;
    }

    if (!found) {
      const created = await input.adapter.createWorkstreamIssue({
        correlationId,
        title: stream.title,
        body: stream.objective,
      });
      found = created;
    }

    try {
      existing.linear_issue_id = found.id;
      existing.status = "DISPATCHED";
      existing.updated_at = nowIso();
      dispatched.push({ workstream_id: stream.workstream_id, linear_issue_id: found.id });
    } catch {
      repaired.push({
        workstream_id: stream.workstream_id,
        linear_issue_id: found.id,
        reason: "External create succeeded but write-back failed; repair required",
      });
    }
  }

  const blockers = [
    ...state.blockers,
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
