import { afterEach, describe, expect, it } from "vitest";
import path from "path";
import { promises as fs } from "fs";
import { DevFileRepository } from "@/lib/repositories/dev-file-store";
import {
  confirmChatIntake,
  handleChatTurn,
  initialChatSession,
} from "@/lib/services/chat-intake-service";
import { conversationToReadiness, readinessToConversation } from "@/lib/conversation/types";
import { buildClarificationPrompts } from "@/lib/conversation/clarifications";
import { analyzeMissionHeuristic } from "@/lib/services/analyze";

const tmpRoot = path.join(process.cwd(), ".data-test-chat");

async function resetRepo() {
  await fs.rm(tmpRoot, { recursive: true, force: true });
  const repo = new DevFileRepository(tmpRoot);
  globalThis.__aiposRepo = repo;
  globalThis.__aiposPersistenceMode = "dev-file";
  return repo;
}

afterEach(async () => {
  globalThis.__aiposRepo = undefined;
  await fs.rm(tmpRoot, { recursive: true, force: true });
});

describe("Chat-first intake flow", () => {
  it("starts in awaiting_mission with welcome", () => {
    const session = initialChatSession("en");
    expect(session.conversation_state).toBe("awaiting_mission");
    expect(session.messages[0]?.kind).toBe("welcome");
    expect(conversationToReadiness("awaiting_mission")).toBe("needs_input");
  });

  it("analyzes a simple English mission and reaches awaiting_confirmation", async () => {
    await resetRepo();
    process.env.NOTION_ADAPTER = "mock";
    process.env.NOTION_MOCK_SUCCESS = "true";

    const turn = await handleChatTurn(
      {
        message: "Summarize the quarterly handbook for new operators",
        idempotency_key: "IDEM-CHAT-1",
      },
      "operator:test",
    );

    expect(turn.intake_id).toBeTruthy();
    expect(turn.draft?.mission_summary).toMatch(/handbook|Summarize/i);
    expect(turn.draft?.success_criteria.join(" ")).not.toMatch(/Mission Object created/i);
    expect(["awaiting_confirmation", "presenting_understanding", "needs_clarification"]).toContain(
      turn.conversation_state,
    );
    // Simple docs mission should not block on format
    expect(turn.clarifications.every((c) => c.code !== "CLARIFY_OUTPUT_FORMAT")).toBe(true);
  });

  it("asks only blocking clarification questions with suggestions", async () => {
    await resetRepo();
    const turn = await handleChatTurn(
      {
        message:
          "ต้องการทำสติกเกอร์การ์ตูนภาพเหมือนจอมยุทธจอมทัพ เพื่อให้ลูกชายและลูกสาวสนุกกับการเล่นแอปพลิเคชันไลน์",
        idempotency_key: "IDEM-CHAT-TH-1",
      },
      "operator:test",
    );

    expect(turn.conversation_state).toBe("needs_clarification");
    expect(turn.clarifications.length).toBeGreaterThan(0);
    expect(turn.clarifications.every((c) => c.blocking !== false)).toBe(true);
    expect(turn.clarifications[0].suggestions.length).toBeLessThanOrEqual(3);
    expect(turn.messages.some((m) => m.kind === "clarification")).toBe(true);
    // Thai preserved in draft
    expect(turn.draft?.desired_outcome).toMatch(/[\u0E00-\u0E7F]/);
    expect(turn.draft?.desired_outcome).not.toMatch(/^Deliver a confirmed/i);
  });

  it("maps conversation state to readiness and confirms to Mission Object", async () => {
    const repo = await resetRepo();
    process.env.NOTION_MOCK_SUCCESS = "true";

    let turn = await handleChatTurn(
      {
        message: "Create a short onboarding checklist for the support team",
        idempotency_key: "IDEM-CHAT-CONF-1",
      },
      "operator:test",
    );

    // Resolve any blocking clarifications if present
    while (turn.clarifications.length > 0 && turn.intake_id) {
      const c = turn.clarifications[0];
      turn = await handleChatTurn(
        {
          message: c.suggestions[0] || "continue",
          intake_id: turn.intake_id,
          clarification_code: c.code,
        },
        "operator:test",
      );
    }

    expect(turn.intake_id).toBeTruthy();
    expect(
      ["awaiting_confirmation", "presenting_understanding"].includes(turn.conversation_state),
    ).toBe(true);
    expect(conversationToReadiness(turn.conversation_state)).toBe("awaiting_confirmation");

    if (!turn.bundle) throw new Error("missing bundle");
    expect(readinessToConversation(turn.bundle)).toMatch(
      /awaiting_confirmation|presenting_understanding/,
    );

    // assumptions vs confirmed facts distinguishable by source
    const sources = new Set(turn.bundle.assumptions.map((a) => a.source));
    expect(sources.has("inferred") || turn.bundle.assumptions.length === 0).toBeTruthy();

    const confirmed = await confirmChatIntake(turn.intake_id!, "operator:test", true);
    expect(confirmed.ok).toBe(true);
    if (!confirmed.ok) return;
    expect(confirmed.status).toBe("ready");
    expect(confirmed.notion.sync_status).toBe("mock_synced");
    expect(confirmed.notion.message).toMatch(/Mock sync only/);

    const mission = await repo.getMissionById(confirmed.mission_id);
    expect(mission?.subtask_ids).toEqual([]);
    expect(mission?.success_criteria?.join(" ") || "").not.toMatch(/Mission Object created/i);
  });
});

describe("Structured form fallback still uses same gates", () => {
  it("advanced form payload path uses create+analyze via chat turn", async () => {
    await resetRepo();
    const turn = await handleChatTurn(
      {
        message: "Draft an SOP outline for weekend store opening",
        constraints: ["No live publish"],
        idempotency_key: "IDEM-CHAT-ADV-1",
      },
      "operator:test",
    );
    expect(turn.bundle?.constraints).toContain("No live publish");
    expect(turn.draft).toBeTruthy();
  });
});

describe("Clarification builder", () => {
  it("only surfaces blocking unresolved blockers", () => {
    const analysis = analyzeMissionHeuristic(
      "Make stickers of cartoon warriors for LINE without specifying file format",
    );
    // Build a minimal bundle-like object for prompts
    const bundle = {
      raw_request: "Make stickers of cartoon warriors for LINE without specifying file format",
      mission_summary: analysis.mission_summary,
      sensitivity_flags: analysis.sensitivity_flags,
      missing_blockers: analysis.missing_blockers,
    } as Parameters<typeof buildClarificationPrompts>[0];

    const prompts = buildClarificationPrompts(bundle);
    expect(prompts.every((p) => p.blocking)).toBe(true);
    expect(prompts.some((p) => p.code === "CLARIFY_SUCCESS_CRITERIA")).toBe(false);
  });
});
