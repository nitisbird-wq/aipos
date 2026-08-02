"use client";

import type { ChatMessage } from "@/lib/conversation/types";

export function ChatThread({
  messages,
  onSuggestion,
  busy,
}: {
  messages: ChatMessage[];
  onSuggestion?: (code: string | undefined, text: string) => void;
  busy?: boolean;
}) {
  return (
    <div className="chat-thread" aria-live="polite">
      {messages.map((m) => (
        <div
          key={m.id}
          className={`chat-bubble chat-bubble-${m.role}${m.kind === "welcome" ? " chat-welcome" : ""}`}
        >
          <div className="chat-meta">
            {m.role === "commander" ? "Mission Commander" : m.role === "user" ? "You" : "System"}
          </div>
          <div className="chat-content whitespace-pre-wrap">{m.content}</div>
          {m.suggestions && m.suggestions.length > 0 && (
            <div className="chat-suggestions">
              {m.suggestions.slice(0, 3).map((s) => (
                <button
                  key={s}
                  type="button"
                  className="chip"
                  disabled={busy}
                  onClick={() => onSuggestion?.(m.clarification_code, s)}
                >
                  {s}
                </button>
              ))}
              <button
                type="button"
                className="chip chip-other"
                disabled={busy}
                onClick={() =>
                  onSuggestion?.(m.clarification_code, detectOtherPlaceholder(m.content))
                }
              >
                Other…
              </button>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function detectOtherPlaceholder(question: string): string {
  // Signal to parent to focus free-text with clarification code retained
  return `__OTHER__:${question.slice(0, 40)}`;
}
