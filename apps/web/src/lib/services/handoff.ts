import {
  HandoffSchema,
  type Evidence,
  type Handoff,
  type MissionState,
} from "@/lib/schemas/contracts";
import { nowIso } from "@/lib/ids";

/**
 * Canonical handoff.v1 builder. Chat/session history is not SoT —
 * workers must emit this structured payload to resume work.
 */
export function createHandoff(input: {
  mission_id: string;
  workstream_id: string;
  run_id: string;
  status: Handoff["status"];
  summary: string;
  mission_state: MissionState;
  received_context?: string[];
  completed_work?: string[];
  changes_made?: string[];
  verification?: string[];
  remaining_work?: string[];
  failures?: string[];
  decisions?: string[];
  assumptions?: string[];
  evidence?: Evidence[];
  evidence_refs?: string[];
  blockers?: string[];
  artifacts?: string[];
  next_action: string;
  requires_human?: boolean;
  human_action_required?: string | null;
  risk_notes?: string[];
  updated_by: string;
}): Handoff {
  return HandoffSchema.parse({
    handoff_version: "handoff.v1",
    mission_id: input.mission_id,
    workstream_id: input.workstream_id,
    run_id: input.run_id,
    status: input.status,
    summary: input.summary,
    mission_state: input.mission_state,
    received_context: input.received_context ?? [],
    completed_work: input.completed_work ?? [],
    changes_made: input.changes_made ?? [],
    verification: input.verification ?? [],
    remaining_work: input.remaining_work ?? [],
    failures: input.failures ?? [],
    decisions: input.decisions ?? [],
    assumptions: input.assumptions ?? [],
    evidence: input.evidence ?? [],
    evidence_refs: input.evidence_refs ?? (input.evidence ?? []).map((e) => e.evidence_ref),
    blockers: input.blockers ?? [],
    artifacts: input.artifacts ?? [],
    next_action: input.next_action,
    requires_human: input.requires_human ?? false,
    human_action_required: input.human_action_required ?? null,
    risk_notes: input.risk_notes ?? [],
    updated_at: nowIso(),
    updated_by: input.updated_by,
  });
}
