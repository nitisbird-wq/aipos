"use client";

import type { DraftMissionPanel } from "@/lib/services/chat-intake-service";

export function DraftMissionSidebar({
  draft,
  conversationState,
}: {
  draft: DraftMissionPanel | null;
  conversationState: string;
}) {
  if (!draft) {
    return (
      <aside className="draft-panel panel p-4">
        <h2 className="text-lg font-bold">Draft Mission</h2>
        <p className="mt-2 text-sm text-[var(--ink-muted)]">
          Describe a mission in the chat. A live draft will appear here after analysis.
        </p>
        <p className="mt-3 text-xs text-[var(--ink-muted)]">
          Conversation: <strong>{conversationState}</strong>
        </p>
      </aside>
    );
  }

  const openBlockers = draft.missing_blockers.filter((b) => b.blocking && !b.resolved);
  const assumptions = draft.assumptions.filter((a) => a.source === "inferred");
  const confirmed = draft.assumptions.filter((a) => a.source === "user_stated");

  return (
    <aside className="draft-panel panel space-y-4 p-4">
      <div>
        <h2 className="text-lg font-bold">Draft Mission</h2>
        <p className="text-xs text-[var(--ink-muted)]">
          Conversation: <strong>{conversationState}</strong> · Readiness:{" "}
          <strong>{draft.readiness_status}</strong>
        </p>
      </div>

      <section>
        <h3 className="text-sm font-bold">Summary</h3>
        <p className="text-sm">{draft.mission_summary || "—"}</p>
      </section>

      <section>
        <h3 className="text-sm font-bold">Desired outcome</h3>
        <p className="text-sm">{draft.desired_outcome || "—"}</p>
      </section>

      <section>
        <h3 className="text-sm font-bold">Mission success criteria</h3>
        <ul className="list-disc pl-4 text-sm">
          {draft.success_criteria.map((c) => (
            <li key={c}>{c}</li>
          ))}
        </ul>
      </section>

      <div className="flex flex-wrap gap-2">
        <span className="badge">Risk {draft.operational_risk}</span>
        {draft.sensitivity_flags.length === 0 ? (
          <span className="badge">No sensitivity flags</span>
        ) : (
          draft.sensitivity_flags.map((f) => (
            <span key={f} className="badge badge-pending">
              {f}
            </span>
          ))
        )}
      </div>

      <section>
        <h3 className="text-sm font-bold">Missing information</h3>
        {openBlockers.length === 0 ? (
          <p className="text-sm text-[var(--ink-muted)]">No blocking gaps</p>
        ) : (
          <ul className="space-y-1 text-sm">
            {openBlockers.map((b) => (
              <li key={b.code} className="rounded border border-[var(--border)] p-2">
                <strong>{b.code}</strong>
                <div>{b.question}</div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h3 className="text-sm font-bold">Assumptions (inferred)</h3>
        <ul className="list-disc pl-4 text-sm text-[var(--ink-muted)]">
          {assumptions.length === 0 ? (
            <li>—</li>
          ) : (
            assumptions.map((a) => <li key={a.id}>{a.text}</li>)
          )}
        </ul>
        {confirmed.length > 0 && (
          <>
            <h3 className="mt-2 text-sm font-bold">Confirmed facts (user-stated)</h3>
            <ul className="list-disc pl-4 text-sm">
              {confirmed.map((a) => (
                <li key={a.id}>{a.text}</li>
              ))}
            </ul>
          </>
        )}
      </section>

      <section>
        <h3 className="text-sm font-bold">Draft Work Map</h3>
        <ul className="space-y-1 text-sm">
          {draft.draft_workstreams.map((ws) => (
            <li key={ws.id}>
              <strong>{ws.id}</strong> {ws.name}
            </li>
          ))}
        </ul>
        <p className="mt-1 text-xs text-[var(--ink-muted)]">
          Families: {draft.capability_families.join(", ") || "—"}
        </p>
      </section>

      <section>
        <h3 className="text-sm font-bold">Destinations</h3>
        <ul className="text-sm">
          {draft.data_destinations.map((d, i) => (
            <li key={`${d.system}-${i}`}>
              {d.system} · {d.purpose}
            </li>
          ))}
        </ul>
      </section>
    </aside>
  );
}
