"use client";

import { useEffect, useState } from "react";

type Stage = { stage_id: string; order: number; title: string };
type Artifact = {
  artifact_id: string;
  revision: number;
  status: string;
  kind: string;
  editable_uri: string;
  final_uri: string | null;
  preview_uri: string | null;
  checksum: string;
  qa_evidence: Array<{ check: string; status: string; evidence_ref: string }>;
  rollback_of_revision: number | null;
  created_at: string;
};
type Comparison = { field: string; left: unknown; right: unknown };

// prettier-ignore
export function MissionArtifactsPanel({ missionId }: { missionId: string }) {
  const [stages, setStages] = useState<Stage[]>([]);
  const [stageId, setStageId] = useState("");
  const [revisions, setRevisions] = useState<Artifact[]>([]);
  const [kind, setKind] = useState("document");
  const [editableUri, setEditableUri] = useState("");
  const [finalUri, setFinalUri] = useState("");
  const [previewUri, setPreviewUri] = useState("");
  const [checksum, setChecksum] = useState("");
  const [renderEvidence, setRenderEvidence] = useState("");
  const [contentEvidence, setContentEvidence] = useState("");
  const [leftRevision, setLeftRevision] = useState("");
  const [rightRevision, setRightRevision] = useState("");
  const [comparison, setComparison] = useState<Comparison[]>([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function loadStages() {
    const res = await fetch(`/api/missions/${missionId}/blueprint`);
    const body = await res.json();
    if (!res.ok) throw new Error(body?.error?.message || "Failed to load stages");
    const nextStages = body.latest?.stages || [];
    setStages(nextStages);
    setStageId((current) => current || nextStages[0]?.stage_id || "");
  }

  async function loadArtifacts(selectedStage = stageId) {
    if (!selectedStage) return;
    const res = await fetch(
      `/api/missions/${missionId}/stages/${selectedStage}/artifacts`,
    );
    const body = await res.json();
    if (!res.ok) throw new Error(body?.error?.message || "Failed to load artifacts");
    setRevisions(body.revisions || []);
  }

  useEffect(() => {
    loadStages().catch((err) => setError(err instanceof Error ? err.message : "Load failed"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [missionId]);

  useEffect(() => {
    loadArtifacts(stageId).catch((err) =>
      setError(err instanceof Error ? err.message : "Artifact load failed"),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [missionId, stageId]);

  function requiredChecks() {
    const normalized = kind.toLowerCase();
    if (normalized.includes("spreadsheet")) return ["formula_integrity", "data_validation"];
    if (normalized.includes("presentation") || normalized.includes("deck")) {
      return ["render_integrity", "slide_overflow"];
    }
    if (normalized.includes("document") || normalized.includes("pdf")) {
      return ["render_integrity", "content_completeness"];
    }
    return ["artifact_accessibility"];
  }

  function qaEvidence() {
    const refs: Record<string, string> = {
      render_integrity: renderEvidence,
      formula_integrity: renderEvidence,
      artifact_accessibility: renderEvidence,
      content_completeness: contentEvidence,
      data_validation: contentEvidence,
      slide_overflow: contentEvidence,
    };
    return requiredChecks()
      .filter((check) => refs[check])
      .map((check) => ({
        check,
        status: "PASS",
        evidence_ref: refs[check],
        verified_at: new Date().toISOString(),
        verified_by: "operator:owner",
      }));
  }

  async function save(status: "DRAFT" | "FINAL") {
    if (!stageId) return;
    setBusy(true);
    setError(null);
    setMessage(null);
    const res = await fetch(
      `/api/missions/${missionId}/stages/${stageId}/artifacts`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status,
          kind,
          editable_uri: editableUri,
          final_uri: finalUri || null,
          preview_uri: previewUri || null,
          checksum,
          qa_evidence: status === "FINAL" ? qaEvidence() : [],
        }),
      },
    );
    const body = await res.json();
    setBusy(false);
    if (!res.ok) {
      setError(body?.error?.message || "Artifact save failed");
      return;
    }
    setMessage(`Artifact revision ${body.artifact.revision} saved as ${status}`);
    await loadArtifacts();
  }

  async function rollback(targetRevision: number) {
    setBusy(true);
    setError(null);
    const res = await fetch(
      `/api/missions/${missionId}/stages/${stageId}/artifacts/rollback`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ target_revision: targetRevision }),
      },
    );
    const body = await res.json();
    setBusy(false);
    if (!res.ok) {
      setError(body?.error?.message || "Rollback failed");
      return;
    }
    setMessage(`Rollback preserved as revision ${body.artifact.revision}`);
    await loadArtifacts();
  }

  async function acceptLatest() {
    setBusy(true);
    setError(null);
    const res = await fetch(
      `/api/missions/${missionId}/stages/${stageId}/artifacts/accept`,
      { method: "POST" },
    );
    const body = await res.json();
    setBusy(false);
    if (!res.ok) {
      setError(body?.error?.message || "Acceptance failed");
      return;
    }
    setMessage(`Accepted artifact; next action: ${body.handoff.next_action}`);
  }

  async function compare() {
    if (!leftRevision || !rightRevision) return;
    const res = await fetch(
      `/api/missions/${missionId}/stages/${stageId}/artifacts?left=${leftRevision}&right=${rightRevision}`,
    );
    const body = await res.json();
    if (!res.ok) {
      setError(body?.error?.message || "Comparison failed");
      return;
    }
    setComparison(body.comparison || []);
  }

  const latest = revisions[0];

  return (
    <section className="panel space-y-4 p-4">
      <div>
        <h2 className="text-xl font-bold">Stage Artifact Pipeline</h2>
        <p className="text-sm text-[var(--ink-muted)]">
          Immutable revisions preserve editable, final, preview, QA, comparison, and rollback evidence.
        </p>
      </div>
      {error && <p className="text-sm text-[var(--danger)]">{error}</p>}
      {message && <p className="text-sm text-[var(--ok)]">{message}</p>}

      <div className="understanding-grid">
        <div className="space-y-3">
          <div className="field">
            <label htmlFor="artifact-stage">Stage</label>
            <select id="artifact-stage" value={stageId} onChange={(event) => setStageId(event.target.value)}>
              {stages.map((stage) => (
                <option key={stage.stage_id} value={stage.stage_id}>
                  {stage.order}. {stage.title}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor="artifact-kind">Artifact kind</label>
            <input id="artifact-kind" value={kind} onChange={(event) => setKind(event.target.value)} />
          </div>
          <div className="field">
            <label htmlFor="artifact-editable">Editable URI</label>
            <input id="artifact-editable" value={editableUri} onChange={(event) => setEditableUri(event.target.value)} />
          </div>
          <div className="field">
            <label htmlFor="artifact-final">Final/download URI</label>
            <input id="artifact-final" value={finalUri} onChange={(event) => setFinalUri(event.target.value)} />
          </div>
          <div className="field">
            <label htmlFor="artifact-preview">Preview/render URI</label>
            <input id="artifact-preview" value={previewUri} onChange={(event) => setPreviewUri(event.target.value)} />
          </div>
          <div className="field">
            <label htmlFor="artifact-checksum">Checksum</label>
            <input id="artifact-checksum" value={checksum} onChange={(event) => setChecksum(event.target.value)} />
          </div>
          <div className="field">
            <label htmlFor="artifact-render-evidence">Render/access evidence ref</label>
            <input id="artifact-render-evidence" value={renderEvidence} onChange={(event) => setRenderEvidence(event.target.value)} />
          </div>
          <div className="field">
            <label htmlFor="artifact-content-evidence">Content/data/overflow evidence ref</label>
            <input id="artifact-content-evidence" value={contentEvidence} onChange={(event) => setContentEvidence(event.target.value)} />
          </div>
          <div className="flex flex-wrap gap-2">
            <button className="btn btn-secondary" disabled={busy || !stageId} type="button" onClick={() => save("DRAFT")}>
              Save draft snapshot
            </button>
            <button className="btn btn-primary" disabled={busy || !stageId} type="button" onClick={() => save("FINAL")}>
              Save final with QA
            </button>
            <button className="btn btn-primary" disabled={busy || !latest || !["FINAL", "ROLLED_BACK"].includes(latest.status)} type="button" onClick={acceptLatest}>
              Accept and continue
            </button>
          </div>
        </div>

        <div className="space-y-3">
          <strong>Compare revisions</strong>
          <div className="flex flex-wrap gap-2">
            <select aria-label="Left artifact revision" value={leftRevision} onChange={(event) => setLeftRevision(event.target.value)}>
              <option value="">Left revision</option>
              {revisions.map((revision) => <option key={`left-${revision.revision}`} value={revision.revision}>R{revision.revision}</option>)}
            </select>
            <select aria-label="Right artifact revision" value={rightRevision} onChange={(event) => setRightRevision(event.target.value)}>
              <option value="">Right revision</option>
              {revisions.map((revision) => <option key={`right-${revision.revision}`} value={revision.revision}>R{revision.revision}</option>)}
            </select>
            <button className="btn btn-secondary" type="button" onClick={compare}>Compare</button>
          </div>
          <ul className="list-disc pl-5 text-sm">
            {comparison.map((row) => (
              <li key={row.field}>{row.field}: {JSON.stringify(row.left)} → {JSON.stringify(row.right)}</li>
            ))}
          </ul>
        </div>
      </div>

      <div className="table-wrap">
        <table className="data">
          <thead><tr><th>Revision</th><th>Status</th><th>Files</th><th>QA</th><th>Lineage</th><th>Action</th></tr></thead>
          <tbody>
            {revisions.map((revision) => (
              <tr key={revision.revision}>
                <td>R{revision.revision}</td>
                <td>{revision.status}</td>
                <td>
                  <a href={revision.editable_uri}>Editable</a>
                  {revision.final_uri ? <> · <a href={revision.final_uri} download>Download</a></> : null}
                  {revision.preview_uri ? <> · <a href={revision.preview_uri} target="_blank" rel="noreferrer">Preview</a></> : null}
                </td>
                <td>{revision.qa_evidence.map((row) => `${row.check}:${row.status}`).join(", ") || "—"}</td>
                <td>{revision.rollback_of_revision ? `rollback of R${revision.rollback_of_revision}` : revision.checksum}</td>
                <td>
                  <button className="btn btn-secondary" disabled={busy || !revision.final_uri} type="button" onClick={() => rollback(revision.revision)}>
                    Roll back to R{revision.revision}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
