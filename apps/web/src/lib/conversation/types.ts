import type { IntakeMissionBundle, ReadinessStatus } from "@/lib/schemas/intake";

/**
 * Conversation layer states for Chat-first Mission Commander.
 * Maps onto IntakeMissionBundle.readiness_status — does not replace the Bundle schema.
 */
export const ConversationStateSchema = [
  "awaiting_mission",
  "analyzing",
  "needs_clarification",
  "presenting_understanding",
  "awaiting_confirmation",
  "ready_to_dispatch",
  "cancelled",
] as const;

export type ConversationState = (typeof ConversationStateSchema)[number];

export type ChatRole = "commander" | "user" | "system";

export type ChatMessage = {
  id: string;
  role: ChatRole;
  content: string;
  created_at: string;
  kind?:
    "welcome" | "mission" | "analysis" | "clarification" | "understanding" | "status" | "error";
  clarification_code?: string;
  suggestions?: string[];
};

export type ClarificationPrompt = {
  code: string;
  question: string;
  suggestions: string[]; // up to 3 + UI adds "Other"
  blocking: boolean;
};

/**
 * Map conversation state → IntakeMissionBundle readiness_status.
 */
export function conversationToReadiness(state: ConversationState): ReadinessStatus | "cancelled" {
  switch (state) {
    case "awaiting_mission":
    case "analyzing":
    case "needs_clarification":
      return "needs_input";
    case "presenting_understanding":
    case "awaiting_confirmation":
      return "awaiting_confirmation";
    case "ready_to_dispatch":
      return "ready_to_dispatch";
    case "cancelled":
      return "cancelled";
  }
}

/**
 * Derive conversation state from an IntakeMissionBundle (+ optional cancel flag).
 */
export function readinessToConversation(
  bundle: IntakeMissionBundle | null,
  opts?: { cancelled?: boolean; analyzing?: boolean },
): ConversationState {
  if (opts?.cancelled) return "cancelled";
  if (!bundle) return "awaiting_mission";
  if (opts?.analyzing) return "analyzing";

  if (bundle.confirmed_by_user && bundle.readiness_status === "ready_to_dispatch") {
    return "ready_to_dispatch";
  }

  const blockingOpen = bundle.missing_blockers.some((b) => b.blocking && !b.resolved);
  if (blockingOpen || bundle.readiness_status === "needs_input") {
    // After analysis with content, open blockers → clarification; empty summary → still analyzing path
    if (bundle.mission_summary) return "needs_clarification";
    return "awaiting_mission";
  }

  if (bundle.readiness_status === "awaiting_confirmation") {
    return "awaiting_confirmation";
  }

  if (bundle.readiness_status === "ready_to_dispatch") {
    return "ready_to_dispatch";
  }

  return "presenting_understanding";
}

export function getConversationRef(bundle: IntakeMissionBundle): {
  state: ConversationState;
  messages: ChatMessage[];
} | null {
  const ref = bundle.knowledge_refs.find(
    (r) => (r as { kind?: string }).kind === "conversation",
  ) as { kind: string; state?: ConversationState; messages?: ChatMessage[] } | undefined;
  if (!ref) return null;
  return {
    state: ref.state ?? readinessToConversation(bundle),
    messages: ref.messages ?? [],
  };
}

export function withConversationRef(
  bundle: IntakeMissionBundle,
  state: ConversationState,
  messages: ChatMessage[],
): IntakeMissionBundle {
  const others = bundle.knowledge_refs.filter(
    (r) => (r as { kind?: string }).kind !== "conversation",
  );
  return {
    ...bundle,
    knowledge_refs: [
      ...others,
      {
        kind: "conversation",
        state,
        messages,
        updated_at: new Date().toISOString(),
      },
    ],
  };
}
