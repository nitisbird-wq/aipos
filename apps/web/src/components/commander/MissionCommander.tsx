"use client";

import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ChatThread } from "@/components/commander/ChatThread";
import { DraftMissionSidebar } from "@/components/commander/DraftMissionSidebar";
import { AdvancedMissionDetails } from "@/components/commander/AdvancedMissionDetails";
import { DraftCorrectionEditor } from "@/components/commander/DraftCorrectionEditor";
import type { DraftCorrection } from "@/lib/schemas/draft-correction";
import type { ChatMessage, ConversationState } from "@/lib/conversation/types";
import type { DraftMissionPanel } from "@/lib/services/chat-intake-service";
import type { IntakeMissionBundle } from "@/lib/schemas/intake";

type ChatSession = {
  intake_id: string | null;
  conversation_state: ConversationState;
  readiness_status: string | null;
  messages: ChatMessage[];
  clarifications: Array<{ code: string; question: string; suggestions: string[] }>;
  draft: DraftMissionPanel | null;
  bundle: IntakeMissionBundle | null;
};

export function MissionCommander() {
  const router = useRouter();
  const [session, setSession] = useState<ChatSession | null>(null);
  const [input, setInput] = useState("");
  const [attachmentRef, setAttachmentRef] = useState("");
  const [showDeadline, setShowDeadline] = useState(false);
  const [deadline, setDeadline] = useState("");
  const [pendingClarification, setPendingClarification] = useState<string | undefined>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  const loadWelcome = useCallback(
    async (fresh = false) => {
      const url = new URL(window.location.href);
      const intakeId = fresh ? null : url.searchParams.get("intake_id");
      const res = await fetch(
        intakeId ? `/api/chat?intake_id=${encodeURIComponent(intakeId)}` : "/api/chat",
      );
      if (res.status === 401) {
        router.push("/login");
        return;
      }
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error?.message || "Failed to load draft");
      if (fresh) {
        url.searchParams.delete("intake_id");
        window.history.replaceState(null, "", url);
      }
      setSession(data);
      setEditing(false);
    },
    [router],
  );

  useEffect(() => {
    loadWelcome().catch(() => setError("Failed to start Mission Commander"));
  }, [loadWelcome]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [session?.messages?.length]);

  async function sendTurn(payload: {
    message: string;
    clarification_code?: string;
    deadline?: string | null;
    constraints?: string[];
    attachments?: Array<Record<string, unknown>>;
  }) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key":
            session?.intake_id && payload.clarification_code
              ? `CLAR-${session.intake_id}-${payload.clarification_code}-${Date.now()}`
              : `CHAT-${crypto.randomUUID()}`,
        },
        body: JSON.stringify({
          message: payload.message,
          intake_id: session?.intake_id ?? undefined,
          clarification_code: payload.clarification_code,
          deadline: payload.deadline ?? undefined,
          constraints: payload.constraints,
          attachments: payload.attachments,
        }),
      });
      if (res.status === 401) {
        router.push("/login");
        return;
      }
      const data = await res.json();
      if (!res.ok) {
        setError(data?.error?.message || "Chat turn failed");
        return;
      }
      setSession(data);
      if (data.intake_id) {
        const url = new URL(window.location.href);
        url.searchParams.set("intake_id", data.intake_id);
        window.history.replaceState(null, "", url);
      }
      setPendingClarification(undefined);
      setInput("");
      setAttachmentRef("");
    } catch {
      setError("Network error");
    } finally {
      setBusy(false);
    }
  }

  async function saveCorrection(patch: DraftCorrection) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/chat", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      if (res.status === 401) {
        router.push("/login");
        return;
      }
      const data = await res.json();
      if (!res.ok) {
        setError(data?.error?.message || "Draft correction failed");
        return;
      }
      setSession(data);
      setEditing(false);
    } catch {
      setError("บันทึกไม่สำเร็จหรือไม่ทราบผล — เปิดร่างเดิมตรวจผลก่อนส่งซ้ำ");
    } finally {
      setBusy(false);
    }
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    const text = input.trim();
    if (!text || busy || !session || editing) return;
    const attachments = attachmentRef.trim()
      ? [{ ref: attachmentRef.trim(), kind: "uri" }]
      : undefined;
    await sendTurn({
      message: text,
      clarification_code: pendingClarification,
      deadline: showDeadline && deadline ? new Date(deadline).toISOString() : null,
      attachments,
    });
  }

  function onSuggestion(code: string | undefined, text: string) {
    if (text.startsWith("__OTHER__:")) {
      setPendingClarification(code);
      setInput("");
      return;
    }
    void sendTurn({ message: text, clarification_code: code });
  }

  async function confirmMission() {
    if (!session?.intake_id) return;
    setBusy(true);
    setError(null);
    const res = await fetch("/api/chat/confirm", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        intake_id: session.intake_id,
        sensitivity_acknowledged:
          (session.bundle?.sensitivity_flags?.length ?? 0) === 0 ||
          session.bundle?.sensitivity_acknowledged,
      }),
    });
    const data = await res.json();
    setBusy(false);
    if (!data.ok) {
      setError(data?.error?.message || data?.error?.code || "Confirm rejected");
      return;
    }
    router.push(`/missions/${data.mission_id}`);
  }

  async function cancelMission() {
    if (!session?.intake_id) {
      await loadWelcome();
      return;
    }
    setBusy(true);
    await fetch(`/api/intakes/${session.intake_id}/cancel`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reason: "Cancelled from Mission Commander" }),
    });
    setBusy(false);
    await loadWelcome();
  }

  const canConfirm =
    !!session?.intake_id &&
    (session.conversation_state === "awaiting_confirmation" ||
      session.conversation_state === "presenting_understanding") &&
    (session.clarifications?.length ?? 0) === 0;

  const canCorrect =
    !!session?.intake_id &&
    session.conversation_state !== "awaiting_mission" &&
    session.conversation_state !== "cancelled" &&
    session.conversation_state !== "ready_to_dispatch";

  return (
    <div className="commander-layout">
      <div className="commander-main">
        <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
          <div>
            <p className="text-sm font-semibold text-[var(--accent)]">Mission Commander</p>
            <h1 className="text-3xl font-bold md:text-4xl">New Mission</h1>
            <p className="mt-1 text-sm text-[var(--ink-muted)]">
              Chat-first intake — describe the mission naturally. Structured form is optional.
            </p>
          </div>
          <button
            type="button"
            className="btn btn-secondary md:hidden"
            onClick={() => setDrawerOpen(true)}
          >
            Draft panel
          </button>
        </div>

        <div className="panel flex min-h-[420px] flex-col overflow-hidden">
          <div className="flex-1 space-y-3 overflow-y-auto p-4 md:p-5">
            {session ? (
              <ChatThread messages={session.messages} onSuggestion={onSuggestion} busy={busy} />
            ) : (
              <p className="text-[var(--ink-muted)]">Starting Mission Commander…</p>
            )}
            <div ref={bottomRef} />
          </div>

          {error && (
            <p className="border-t border-[var(--border)] px-4 py-2 text-sm text-[var(--danger)]">
              {error}
            </p>
          )}

          <form className="composer border-t border-[var(--border)] p-3 md:p-4" onSubmit={onSubmit}>
            <label className="sr-only" htmlFor="mission_chat_input">
              Mission message
            </label>
            <textarea
              id="mission_chat_input"
              className="composer-input"
              rows={3}
              placeholder={
                pendingClarification
                  ? "Type your answer (Other)…"
                  : "Describe your mission in natural language…"
              }
              value={input}
              onChange={(e) => setInput(e.target.value)}
              disabled={
                busy ||
                editing ||
                !session ||
                session.conversation_state === "cancelled" ||
                session.conversation_state === "ready_to_dispatch"
              }
            />
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <button
                type="button"
                className="btn btn-secondary !py-1.5 !text-sm"
                onClick={() => {
                  const ref = window.prompt("Attachment reference (URI or path only)");
                  if (ref) setAttachmentRef(ref);
                }}
              >
                Attach ref
              </button>
              <button
                type="button"
                className="btn btn-secondary !py-1.5 !text-sm"
                onClick={() => setShowDeadline((v) => !v)}
              >
                {showDeadline ? "Hide deadline" : "Deadline"}
              </button>
              {attachmentRef && (
                <span className="badge" title={attachmentRef}>
                  ref attached
                </span>
              )}
              {showDeadline && (
                <input
                  type="datetime-local"
                  value={deadline}
                  onChange={(e) => setDeadline(e.target.value)}
                  className="rounded-md border border-[var(--border)] px-2 py-1 text-sm"
                />
              )}
              <div className="ml-auto flex flex-wrap gap-2">
                <button
                  className="btn btn-primary"
                  type="submit"
                  disabled={busy || editing || !session || !input.trim()}
                >
                  {busy ? "Sending…" : "Send"}
                </button>
              </div>
            </div>
          </form>
        </div>

        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            className="btn btn-primary"
            disabled={busy || editing || !canConfirm}
            onClick={confirmMission}
          >
            Confirm mission
          </button>
          <button
            type="button"
            className="btn btn-secondary"
            disabled={busy || !canCorrect}
            onClick={() => {
              setEditing(true);
              setInput("");
              setPendingClarification(undefined);
              setError(null);
            }}
          >
            Correct understanding
          </button>
          <button
            type="button"
            className="btn btn-danger"
            disabled={busy || editing}
            onClick={cancelMission}
          >
            Cancel intake
          </button>
          <button
            type="button"
            className="btn btn-secondary"
            disabled={busy || editing}
            onClick={() => {
              void loadWelcome(true).catch(() => setError("Failed to start new intake"));
            }}
          >
            New mission
          </button>
        </div>

        {editing && session?.bundle && (
          <DraftCorrectionEditor
            key={session.bundle.updated_at}
            bundle={session.bundle}
            busy={busy}
            onSave={saveCorrection}
            onClose={() => setEditing(false)}
          />
        )}

        <div className="mt-4">
          {session?.intake_id ? (
            <p className="text-sm">
              มีร่างเดิมแล้ว: ใช้ Correct understanding เพื่อแก้ไข ไม่ต้องสร้างร่างใหม่
            </p>
          ) : (
            <AdvancedMissionDetails
              disabled={busy || !session || !!session.intake_id}
              onSubmitStructured={(payload) => {
                void sendTurn({
                  message: payload.raw_request,
                  deadline: payload.deadline,
                  constraints: payload.constraints,
                });
              }}
            />
          )}
        </div>
      </div>

      <div className="commander-side hide-mobile">
        <DraftMissionSidebar
          draft={session?.draft ?? null}
          conversationState={session?.conversation_state ?? "awaiting_mission"}
        />
      </div>

      {drawerOpen && (
        <div className="draft-drawer md:hidden">
          <div className="draft-drawer-backdrop" onClick={() => setDrawerOpen(false)} />
          <div className="draft-drawer-panel">
            <button
              type="button"
              className="btn btn-secondary mb-3 w-full"
              onClick={() => setDrawerOpen(false)}
            >
              Close
            </button>
            <DraftMissionSidebar
              draft={session?.draft ?? null}
              conversationState={session?.conversation_state ?? "awaiting_mission"}
            />
          </div>
        </div>
      )}
    </div>
  );
}
