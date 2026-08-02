import { describe, expect, it } from "vitest";
import { evaluateMapping } from "@/lib/gates/mapping-gate";
import type { IntakeMissionBundle } from "@/lib/schemas/intake";

function readyBundle(over: Partial<IntakeMissionBundle> = {}): IntakeMissionBundle {
  const now = new Date().toISOString();
  return {
    intake_id: "INT-TEST000003",
    intake_version: "1.0",
    requester_id: "operator:test",
    source: "web_app",
    source_message_ref: "web:test",
    raw_request: "Create a strategy brief",
    mission_summary: "Strategy brief",
    desired_outcome: "Brief delivered",
    success_criteria: ["Brief ready"],
    constraints: [],
    assumptions: [],
    missing_blockers: [],
    draft_workstreams: [],
    capability_families: ["strategy_analysis"],
    operational_risk: "L1",
    sensitivity_flags: [],
    sensitivity_acknowledged: true,
    approval_requirements: [],
    knowledge_refs: [],
    attachments: [],
    data_destinations: [
      {
        system: "intake_channel",
        trust_class: "approved_private",
        purpose: "chat_only",
        persistence: "conversation_only",
        external_transfer: false,
      },
      {
        system: "notion",
        trust_class: "approved_private",
        purpose: "mission_registry",
        persistence: "durable",
        external_transfer: true,
      },
    ],
    data_handling_requirements: [],
    deadline: null,
    readiness_status: "ready_to_dispatch",
    confirmed_by_user: true,
    idempotency_key: "IDEM-3",
    created_at: now,
    updated_at: now,
    ...over,
  };
}

describe("Mapping Gate", () => {
  it("accepts a ready confirmed bundle", () => {
    const result = evaluateMapping(readyBundle());
    expect(result.ok).toBe(true);
  });

  it("rejects with INTAKE_NOT_CONFIRMED", () => {
    const result = evaluateMapping(readyBundle({ confirmed_by_user: false }));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("INTAKE_NOT_CONFIRMED");
  });

  it("rejects with MISSING_SUCCESS_CRITERIA", () => {
    const result = evaluateMapping(readyBundle({ success_criteria: [] }));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("MISSING_SUCCESS_CRITERIA");
  });

  it("rejects with UNRESOLVED_BLOCKER", () => {
    const result = evaluateMapping(
      readyBundle({
        missing_blockers: [{ code: "B1", question: "Need info", blocking: true, resolved: false }],
      }),
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("UNRESOLVED_BLOCKER");
  });

  it("rejects with DATA_DESTINATION_NOT_APPROVED", () => {
    const result = evaluateMapping(
      readyBundle({
        data_destinations: [
          {
            system: "random_cloud",
            trust_class: "x",
            purpose: "x",
            persistence: "x",
            external_transfer: true,
          },
        ],
      }),
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("DATA_DESTINATION_NOT_APPROVED");
  });

  it("rejects with HANDLING_GATE_FAILED when sensitivity not acknowledged", () => {
    const result = evaluateMapping(
      readyBundle({
        sensitivity_flags: ["credentials"],
        sensitivity_acknowledged: false,
      }),
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("HANDLING_GATE_FAILED");
  });
});
