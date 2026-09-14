"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import type { PlanReviewState, OutcomeWorkstream, OwnerQuestion } from "@/lib/schemas/contracts";

type ApiResponse<T> = { ok: boolean; plan?: T; error?: string };

type EditState = {
  wsId: string;
  title: string;
  objective: string;
  owner_notes: string;
  acceptance_criteria: string;
};

const APPROVAL_BADGE: Record<string, { label: string; className: string }> = {
  PROPOSED: { label: "Proposed", className: "bg-yellow-100 text-yellow-800" },
  APPROVED: { label: "Approved", className: "bg-blue-100 text-blue-800" },
  DISPATCHABLE: { label: "Dispatchable", className: "bg-green-100 text-green-800" },
};

const RISK_COLOR: Record<string, string> = {
  L0: "text-green-700",
  L1: "text-green-600",
  L2: "text-yellow-700",
  L3: "text-orange-700",
  L4: "text-red-700",
};

export default function PlanReviewPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const missionId = params.id;

  const [plan, setPlan] = useState<PlanReviewState | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editState, setEditState] = useState<EditState | null>(null);
  const [saving, setSaving] = useState<string | null>(null);

  const base = `/api/missions/${missionId}/plan`;

  const fetchPlan = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(base);
      if (res.status === 404) {
        const genRes = await fetch(base, { method: "POST", body: "{}" });
        const data: ApiResponse<PlanReviewState> = await genRes.json();
        if (data.ok && data.plan) setPlan(data.plan);
        else setError("Failed to generate plan");
      } else {
        const data: ApiResponse<PlanReviewState> = await res.json();
        if (data.ok && data.plan) setPlan(data.plan);
        else setError("Failed to load plan");
      }
    } catch {
      setError("Network error loading plan");
    } finally {
      setLoading(false);
    }
  }, [base]);

  useEffect(() => {
    fetchPlan();
  }, [fetchPlan]);

  async function callApi(url: string, method: string, body?: unknown): Promise<boolean> {
    setSaving(url);
    try {
      const res = await fetch(url, {
        method,
        headers: { "content-type": "application/json" },
        body: body !== undefined ? JSON.stringify(body) : undefined,
      });
      const data: ApiResponse<PlanReviewState> = await res.json();
      if (data.ok && data.plan) {
        setPlan(data.plan);
        return true;
      }
      setError(data.error ?? "Request failed");
      return false;
    } catch {
      setError("Network error");
      return false;
    } finally {
      setSaving(null);
    }
  }

  async function approveWorkstream(wsId: string) {
    await callApi(`${base}/workstreams/${wsId}/approve`, "POST");
  }

  async function removeWorkstream(wsId: string) {
    await callApi(`${base}/workstreams/${wsId}`, "DELETE");
  }

  function startEdit(ws: OutcomeWorkstream) {
    setEditState({
      wsId: ws.workstream_id,
      title: ws.title,
      objective: ws.objective,
      owner_notes: ws.owner_notes,
      acceptance_criteria: ws.acceptance_criteria.join("\n"),
    });
  }

  async function submitEdit() {
    if (!editState) return;
    const ok = await callApi(`${base}/workstreams/${editState.wsId}`, "PATCH", {
      title: editState.title,
      objective: editState.objective,
      owner_notes: editState.owner_notes,
      acceptance_criteria: editState.acceptance_criteria
        .split("\n")
        .map((s) => s.trim())
        .filter(Boolean),
    });
    if (ok) setEditState(null);
  }

  async function approveAll() {
    await callApi(`${base}/approve-all`, "POST");
  }

  async function regenerate() {
    await callApi(`${base}/regenerate`, "POST");
  }

  async function answerQuestion(q: OwnerQuestion, answer: string) {
    await callApi(`${base}/questions/${q.id}`, "PATCH", { answer });
  }

  if (loading)
    return (
      <div className="panel p-6">
        <p className="text-[var(--ink-muted)]">Generating mission plan…</p>
      </div>
    );

  if (error)
    return (
      <div className="panel p-6 space-y-3">
        <p className="text-red-600">{error}</p>
        <button className="btn btn-secondary" onClick={fetchPlan}>
          Retry
        </button>
      </div>
    );

  if (!plan) return null;

  const allDispatchable = plan.workstreams.every((ws) => ws.approval_state === "DISPATCHABLE");

  return (
    <div className="space-y-6 p-4 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <nav className="text-sm text-[var(--ink-muted)] flex gap-1 flex-wrap">
            <Link href="/intake" className="hover:underline">
              Intake
            </Link>
            <span>›</span>
            <span>Plan Review</span>
          </nav>
          <h1 className="text-2xl font-bold mt-1">Mission Plan Review</h1>
          <p className="text-sm text-[var(--ink-muted)]">
            Mission: <code>{missionId}</code> — Strategy: <code>{plan.strategy_id}</code>
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <span
            className={`px-2 py-1 rounded text-xs font-medium ${
              plan.review_status === "APPROVED"
                ? "bg-green-100 text-green-800"
                : plan.review_status === "IN_REVIEW"
                  ? "bg-blue-100 text-blue-800"
                  : "bg-yellow-100 text-yellow-800"
            }`}
          >
            {plan.review_status.replace("_", " ")}
          </span>
        </div>
      </div>

      {/* Workstreams */}
      <section>
        <h2 className="text-lg font-semibold mb-3">Workstreams</h2>
        <div className="space-y-3">
          {plan.workstreams.map((ws) => {
            const badge = APPROVAL_BADGE[ws.approval_state] ?? APPROVAL_BADGE["PROPOSED"]!;
            const riskColor = RISK_COLOR[ws.risk_level] ?? "text-gray-700";
            const isBusy = saving !== null;
            return (
              <div key={ws.workstream_id} className="border rounded-lg p-4 space-y-2">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={`px-2 py-0.5 rounded text-xs font-medium ${badge.className}`}
                      >
                        {badge.label}
                      </span>
                      <span className={`text-xs font-mono ${riskColor}`}>{ws.risk_level}</span>
                      <span className="text-xs text-[var(--ink-muted)]">#{ws.execution_order}</span>
                    </div>
                    <p className="font-medium mt-1 break-words">{ws.title}</p>
                    <p className="text-sm text-[var(--ink-muted)] break-words">{ws.objective}</p>
                    {ws.owner_notes && (
                      <p className="text-xs italic text-[var(--ink-muted)] mt-1">
                        Note: {ws.owner_notes}
                      </p>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-1 shrink-0">
                    {ws.approval_state === "PROPOSED" && (
                      <button
                        className="btn btn-primary text-xs px-2 py-1"
                        disabled={isBusy}
                        onClick={() => approveWorkstream(ws.workstream_id)}
                      >
                        Approve
                      </button>
                    )}
                    <button
                      className="btn btn-secondary text-xs px-2 py-1"
                      disabled={isBusy}
                      onClick={() => startEdit(ws)}
                    >
                      Edit
                    </button>
                    <button
                      className="btn btn-danger text-xs px-2 py-1"
                      disabled={isBusy || plan.workstreams.length <= 1}
                      onClick={() => removeWorkstream(ws.workstream_id)}
                    >
                      Remove
                    </button>
                  </div>
                </div>
                <details className="text-sm">
                  <summary className="cursor-pointer text-[var(--ink-muted)] select-none">
                    Acceptance criteria
                  </summary>
                  <ul className="mt-1 list-disc list-inside space-y-0.5 pl-2">
                    {ws.acceptance_criteria.map((c, i) => (
                      <li key={i} className="text-[var(--ink-muted)]">
                        {c}
                      </li>
                    ))}
                  </ul>
                </details>
              </div>
            );
          })}
        </div>

        {/* Bottom actions */}
        <div className="mt-4 flex flex-wrap gap-2">
          <button
            className="btn btn-secondary text-sm"
            disabled={saving !== null}
            onClick={regenerate}
          >
            Regenerate
          </button>
          {!allDispatchable && (
            <button
              className="btn btn-primary text-sm"
              disabled={saving !== null}
              onClick={approveAll}
            >
              Approve All
            </button>
          )}
          {allDispatchable && (
            <button className="btn btn-primary text-sm" onClick={() => router.push(`/intake`)}>
              Proceed to Dispatch ›
            </button>
          )}
        </div>
      </section>

      {/* Edit modal */}
      {editState && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-[var(--surface)] rounded-xl shadow-xl w-full max-w-lg space-y-4 p-6">
            <h2 className="text-lg font-semibold">Edit Workstream</h2>
            <label className="block space-y-1">
              <span className="text-sm font-medium">Title</span>
              <input
                className="w-full border rounded px-3 py-2 text-sm"
                value={editState.title}
                onChange={(e) => setEditState({ ...editState, title: e.target.value })}
              />
            </label>
            <label className="block space-y-1">
              <span className="text-sm font-medium">Objective</span>
              <textarea
                className="w-full border rounded px-3 py-2 text-sm h-20 resize-none"
                value={editState.objective}
                onChange={(e) => setEditState({ ...editState, objective: e.target.value })}
              />
            </label>
            <label className="block space-y-1">
              <span className="text-sm font-medium">Acceptance criteria (one per line)</span>
              <textarea
                className="w-full border rounded px-3 py-2 text-sm h-24 resize-none"
                value={editState.acceptance_criteria}
                onChange={(e) =>
                  setEditState({ ...editState, acceptance_criteria: e.target.value })
                }
              />
            </label>
            <label className="block space-y-1">
              <span className="text-sm font-medium">Owner notes</span>
              <input
                className="w-full border rounded px-3 py-2 text-sm"
                value={editState.owner_notes}
                onChange={(e) => setEditState({ ...editState, owner_notes: e.target.value })}
              />
            </label>
            <div className="flex justify-end gap-2">
              <button className="btn btn-secondary text-sm" onClick={() => setEditState(null)}>
                Cancel
              </button>
              <button
                className="btn btn-primary text-sm"
                disabled={saving !== null}
                onClick={submitEdit}
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Owner questions */}
      <section>
        <h2 className="text-lg font-semibold mb-3">Owner Questions</h2>
        <p className="text-sm text-[var(--ink-muted)] mb-3">
          These questions help refine the plan. Required questions are marked with *.
        </p>
        <div className="space-y-3">
          {plan.owner_questions.map((q) => (
            <div key={q.id} className="border rounded-lg p-3 space-y-2">
              <p className="text-sm font-medium">
                {q.question}
                {q.required && <span className="text-red-500 ml-1">*</span>}
              </p>
              <textarea
                className="w-full border rounded px-3 py-2 text-sm h-16 resize-none"
                placeholder="Your answer…"
                defaultValue={q.answer ?? ""}
                onBlur={(e) => {
                  const val = e.target.value.trim();
                  if (val !== (q.answer ?? "")) answerQuestion(q, val);
                }}
              />
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
