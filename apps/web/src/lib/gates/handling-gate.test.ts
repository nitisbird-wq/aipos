import { describe, expect, it } from "vitest";
import { evaluateHandling } from "@/lib/gates/handling-gate";
import type { IntakeMissionBundle } from "@/lib/schemas/intake";

function baseBundle(over: Partial<IntakeMissionBundle> = {}): IntakeMissionBundle {
  const now = new Date().toISOString();
  return {
    intake_id: "INT-TEST000002",
    intake_version: "1.0",
    requester_id: "operator:test",
    source: "web_app",
    source_message_ref: "web:test",
    raw_request: "Handle personal data carefully",
    mission_summary: "Handle data",
    desired_outcome: "Safe handling",
    success_criteria: ["Handled"],
    constraints: [],
    assumptions: [],
    missing_blockers: [],
    draft_workstreams: [],
    capability_families: ["docs"],
    operational_risk: "L1",
    sensitivity_flags: ["personal_data"],
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
    readiness_status: "awaiting_confirmation",
    confirmed_by_user: false,
    idempotency_key: "IDEM-2",
    created_at: now,
    updated_at: now,
    ...over,
  };
}

describe("Handling Gate", () => {
  it("passes when sensitivity acknowledged and destinations approved", () => {
    const result = evaluateHandling(baseBundle());
    expect(result.ok).toBe(true);
    expect(result.requirements).toContain("redact_in_audit_display");
  });

  it("fails when sensitivity not acknowledged", () => {
    const result = evaluateHandling(baseBundle({ sensitivity_acknowledged: false }));
    expect(result.ok).toBe(false);
    expect(result.code).toBe("HANDLING_GATE_FAILED");
  });

  it("allows notion mission_registry even with sensitivity when acknowledged", () => {
    const result = evaluateHandling(
      baseBundle({
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
      }),
    );
    expect(result.ok).toBe(true);
  });

  it("fails chat_only without intake_channel", () => {
    const result = evaluateHandling(
      baseBundle({
        sensitivity_flags: [],
        sensitivity_acknowledged: true,
        data_destinations: [
          {
            system: "somewhere_else",
            trust_class: "x",
            purpose: "chat_only",
            persistence: "conversation_only",
            external_transfer: false,
          },
        ],
      }),
    );
    expect(result.ok).toBe(false);
  });
});
