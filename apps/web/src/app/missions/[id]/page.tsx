"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { SyncBadge, SyncStatusMessage } from "@/components/SyncBadge";
import { TransitionControls } from "@/components/TransitionControls";
import type { MissionStatus, CanonicalTransitionCommand } from "@/lib/schemas/mission";

type MissionDetail = {
  mission: {
    mission_id: string;
    status: MissionStatus;
    planning_status: string;
    mission_summary?: string;
    desired_outcome?: string;
    success_criteria?: string[];
    operational_risk?: string;
    sensitivity_flags?: string[];
    subtask_ids: string[];
    source_intake_id: string;
    gate_results?: {
      system_checks?: string[];
      intake_validation?: { language?: string; system_checks?: string[] };
    };
    intake_evidence?: {
      raw_request?: string;
      intake_validation?: { language?: string; system_checks?: string[] };
    };
  };
  notion_sync: {
    sync_status: string;
    notion_page_id: string | null;
    last_error: string | null;
    mock_record_id?: string | null;
  } | null;
  intake: {
    raw_request?: string;
    view?: string;
  } | null;
};

type AuditEvent = {
  id: string;
  actor: string;
  action: string;
  reason: string;
  correlation_id: string;
  previous_state: string | null;
  new_state: string | null;
  created_at: string;
  policy_result: Record<string, unknown>;
};

export default function MissionDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const id = params.id;
  const [data, setData] = useState<MissionDetail | null>(null);
  const [audit, setAudit] = useState<AuditEvent[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function load() {
    const [mRes, aRes] = await Promise.all([
      fetch(`/api/missions/${id}`),
      fetch(`/api/missions/${id}/audit`),
    ]);
    if (mRes.status === 401) {
      router.push("/login");
      return;
    }
    const mData = await mRes.json();
    const aData = await aRes.json();
    if (!mRes.ok) {
      setError(mData?.error?.message || "Failed to load mission");
      return;
    }
    setData(mData);
    setAudit(aData.events || []);
  }

  useEffect(() => {
    load().catch(() => setError("Failed to load"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  async function transition(command: CanonicalTransitionCommand) {
    setBusy(true);
    setMessage(null);
    setError(null);
    const res = await fetch(`/api/missions/${id}/transitions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Correlation-Id": `COR-UI-${Date.now()}`,
      },
      body: JSON.stringify({
        command,
        reason: `UI transition: ${command}`,
      }),
    });
    const body = await res.json();
    setBusy(false);
    if (!body.ok) {
      setError(body?.message || body?.error?.message || "Invalid transition");
      return;
    }
    setMessage(`Transition applied → ${body.mission.status}`);
    await load();
  }

  async function retryNotion() {
    setBusy(true);
    setMessage(null);
    setError(null);
    const res = await fetch(`/api/missions/${id}/notion/retry`, { method: "POST" });
    const body = await res.json();
    setBusy(false);
    if (!body.ok) {
      setError(body?.error?.message || body?.message || "Retry rejected");
      return;
    }
    setMessage(body.notion?.message || `Notion status: ${body.notion?.sync_status}`);
    await load();
  }

  if (!data) return <p className="text-[var(--ink-muted)]">{error || "Loading mission…"}</p>;
  const m = data.mission;
  const syncStatus = data.notion_sync?.sync_status;
  const showRetry = syncStatus === "failed";
  const systemChecks =
    m.gate_results?.system_checks ||
    m.gate_results?.intake_validation?.system_checks ||
    m.intake_evidence?.intake_validation?.system_checks ||
    [];
  const ownerRequest = data.intake?.raw_request || m.intake_evidence?.raw_request || null;

  return (
    <div className="space-y-5">
      <div>
        <p className="text-sm font-semibold text-[var(--accent)]">{m.mission_id}</p>
        <h1 className="text-3xl font-bold md:text-4xl">Mission Detail</h1>
        <div className="mt-3 flex flex-wrap gap-2">
          <span className="badge">status: {m.status}</span>
          <span className="badge">planning: {m.planning_status}</span>
          <span className="badge">risk: {m.operational_risk}</span>
          <SyncBadge status={syncStatus} pageId={data.notion_sync?.notion_page_id} />
        </div>
      </div>

      {error && <p className="text-sm text-[var(--danger)]">{error}</p>}
      {message && <p className="text-sm text-[var(--ok)]">{message}</p>}

      <div className="understanding-grid">
        <section className="panel space-y-3 p-4">
          <h2 className="text-xl font-bold">Confirmed understanding</h2>
          <p>
            <strong>Summary:</strong> {m.mission_summary}
          </p>
          <p>
            <strong>Outcome:</strong> {m.desired_outcome}
          </p>
          <div>
            <strong>Mission success criteria</strong>
            <ul className="list-disc pl-5 text-sm">
              {(m.success_criteria || []).map((c) => (
                <li key={c}>{c}</li>
              ))}
            </ul>
          </div>
          {systemChecks.length > 0 && (
            <div>
              <strong>System intake validation</strong>
              <p className="text-xs text-[var(--ink-muted)]">
                Gate/system checks — not mission outcome criteria.
              </p>
              <ul className="list-disc pl-5 text-sm text-[var(--ink-muted)]">
                {systemChecks.map((c) => (
                  <li key={c}>{c}</li>
                ))}
              </ul>
            </div>
          )}
          <p className="text-sm text-[var(--ink-muted)]">
            Source intake: {m.source_intake_id} · subtask_ids: [{m.subtask_ids.join(", ")}] (must be
            empty at Intake MVP)
          </p>
          {ownerRequest && (
            <div className="text-sm">
              <strong>Original request (owner view)</strong>
              <p className="mt-1 whitespace-pre-wrap rounded-md border border-[var(--border)] bg-[#fcfdfc] p-2">
                {ownerRequest}
              </p>
              <p className="mt-1 text-xs text-[var(--ink-muted)]">
                Owner-facing confirmed request is shown in full. Audit/log views apply sensitivity
                redaction with rule attribution.
              </p>
            </div>
          )}
        </section>

        <section className="panel space-y-3 p-4">
          <h2 className="text-xl font-bold">Notion sync</h2>
          <SyncBadge status={syncStatus} pageId={data.notion_sync?.notion_page_id} />
          <SyncStatusMessage
            status={syncStatus}
            pageId={data.notion_sync?.notion_page_id}
            mockRecordId={data.notion_sync?.mock_record_id}
            message={data.notion_sync?.last_error}
          />
          <p className="text-sm text-[var(--ink-muted)]">
            External page ID: {data.notion_sync?.notion_page_id || "—"}
          </p>
          {showRetry ? (
            <button
              className="btn btn-secondary"
              disabled={busy}
              type="button"
              onClick={retryNotion}
            >
              Retry Notion sync
            </button>
          ) : (
            <p className="text-xs text-[var(--ink-muted)]">
              Retry is available only when sync_status = failed
              {syncStatus ? ` (current: ${syncStatus})` : ""}.
            </p>
          )}

          <h2 className="pt-4 text-xl font-bold">Transitions</h2>
          <TransitionControls status={m.status} busy={busy} onTransition={transition} />
        </section>
      </div>

      <section className="panel p-4">
        <h2 className="text-xl font-bold">Audit log</h2>
        <div className="table-wrap mt-3">
          <table className="data">
            <thead>
              <tr>
                <th>When</th>
                <th>Actor</th>
                <th>Action</th>
                <th>State</th>
                <th>Correlation</th>
              </tr>
            </thead>
            <tbody>
              {audit.map((e) => (
                <tr key={e.id}>
                  <td className="whitespace-nowrap text-xs">{e.created_at}</td>
                  <td className="text-sm">{e.actor}</td>
                  <td className="text-sm">
                    <div className="font-semibold">{e.action}</div>
                    <div className="text-[var(--ink-muted)]">{e.reason}</div>
                  </td>
                  <td className="text-sm">
                    {e.previous_state || "—"} → {e.new_state || "—"}
                  </td>
                  <td className="font-mono text-xs">{e.correlation_id}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
