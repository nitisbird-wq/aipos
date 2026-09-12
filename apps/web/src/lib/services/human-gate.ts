import { evaluateAuthorityDecision } from "@/lib/services/authority";
import {
  getMissionControlState,
  upsertMissionControlState,
} from "@/lib/services/control-plane-state";
import { nowIso } from "@/lib/ids";

export async function applyHumanGate(input: {
  missionId: string;
  action: string;
  risk_level: "L0" | "L1" | "L2" | "L3" | "L4";
  reversible: boolean;
  delegated: boolean;
}) {
  const decision = evaluateAuthorityDecision({
    proposed_action: input.action,
    risk_level: input.risk_level,
    reversible: input.reversible,
    delegated: input.delegated,
  });

  if (decision.decision !== "HUMAN_GATE") {
    return {
      authorized: true,
      decision: decision.decision,
      reason: decision.reason,
      requires_human: false,
    };
  }

  const state = await getMissionControlState(input.missionId);
  await upsertMissionControlState(input.missionId, "authority_evaluator", {
    blockers: [
      ...state.blockers,
      {
        mission_id: input.missionId,
        workstream_id: null,
        code: "HUMAN_GATE_REQUIRED",
        detail: `${input.action}: ${decision.reason}`,
        requires_human: true,
        opened_at: nowIso(),
        resolved: false,
      },
    ],
    mission_state: "WAITING_HUMAN",
    next_action: "Owner approval required for consequential action",
    responsible: "owner",
    updated_at: nowIso(),
  });
  return {
    authorized: false,
    decision: decision.decision,
    reason: decision.reason,
    requires_human: true,
  };
}
