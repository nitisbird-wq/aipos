import { describe, expect, it } from "vitest";
import { evaluateReadiness } from "@/lib/gates/readiness-gate";
import type { IntakeMissionBundle } from "@/lib/schemas/intake";

function baseBundle(over: Partial<IntakeMissionBundle> = {}): IntakeMissionBundle {
  const now = new Date().toISOString();
  return {
    intake_id: "INT-TEST000001",
    intake_version: "1.0",
    requester_id: "operator:test",
    source: "web_app",
    source_message_ref: "web:test",
    raw_request: "Draft a docs summary",
    mission_summary: "Summarize docs",
    desired_outcome: "A clear summary",
    success_criteria: ["Summary delivered"],
    constraints: [],
    assumptions: [],
    missing_blockers: [],
    draft_workstreams: [],
    capability_families: ["docs"],
    operational_risk: "L0",
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
    ],
    data_handling_requirements: [],
    deadline: null,
    readiness_status: "needs_input",
    confirmed_by_user: false,
    idempotency_key: "IDEM-1",
    created_at: now,
    updated_at: now,
    ...over,
  };
}

describe("Readiness Gate", () => {
  it("returns awaiting_confirmation when complete and unconfirmed", () => {
    const result = evaluateReadiness(baseBundle());
    expect(result.ok).toBe(true);
    expect(result.readiness_status).toBe("awaiting_confirmation");
  });

  it("returns ready_to_dispatch when confirmed", () => {
    const result = evaluateReadiness(baseBundle({ confirmed_by_user: true }));
    expect(result.ok).toBe(true);
    expect(result.readiness_status).toBe("ready_to_dispatch");
  });

  it("needs_input when success criteria missing", () => {
    const result = evaluateReadiness(baseBundle({ success_criteria: [] }));
    expect(result.ok).toBe(false);
    expect(result.readiness_status).toBe("needs_input");
    expect(result.codes).toContain("MISSING_SUCCESS_CRITERIA");
  });

  it("needs_input for unresolved blockers", () => {
    const result = evaluateReadiness(
      baseBundle({
        missing_blockers: [
          {
            code: "X",
            question: "?",
            blocking: true,
            resolved: false,
          },
        ],
      }),
    );
    expect(result.ok).toBe(false);
    expect(result.codes).toContain("UNRESOLVED_BLOCKER");
  });

  it("rejects system=none destination", () => {
    const result = evaluateReadiness(
      baseBundle({
        data_destinations: [
          {
            system: "none",
            trust_class: "x",
            purpose: "chat_only",
            persistence: "conversation_only",
            external_transfer: false,
          },
        ],
      }),
    );
    expect(result.ok).toBe(false);
    expect(result.codes).toContain("FORBIDDEN_DESTINATION_NONE");
  });
});
