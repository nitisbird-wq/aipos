"use client";

import { useEffect, useState } from "react";

type BlueprintStage = {
  stage_id: string;
  order: number;
  title: string;
  objective: string;
  outputs: string[];
  dependencies: string[];
  entry_criteria: string[];
  exit_criteria: string[];
  owner: string;
  status: string;
  evidence_refs: string[];
};

type Blueprint = {
  blueprint_id: string;
  revision: number;
  status: "DRAFT" | "IN_REVIEW" | "APPROVED" | "SUPERSEDED";
  final_outcome: string;
  definition_of_done: string;
  stages: BlueprintStage[];
  critical_path: string[];
  progress: {
    completed_stages: number;
    total_stages: number;
    percent: number;
    evidence_refs: string[];
  };
  next_action: string;
  approved_at: string | null;
  approved_by: string | null;
};

export function MissionBlueprintPanel(props: {
  missionId: string;
  desiredOutcome?: string;
  successCriteria?: string[];
}) {
  const [latest, setLatest] = useState<Blueprint | null>(null);
  const [revisions, setRevisions] = useState<Blueprint[]>([]);
  const [finalOutcome, setFinalOutcome] = useState(props.desiredOutcome || "");
  const [definitionOfDone, setDefinitionOfDone] = useState(
    (props.successCriteria || []).join("; "),
  );
  const [nextAction, setNextAction] = useState("Review and approve the Mission Blueprint");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    const res = await fetch(`/api/missions/${props.missionId}/blueprint`);
    const body = await res.json();
    if (!res.ok) throw new Error(body?.error?.message || "Failed to load Blueprint");
    setLatest(body.latest || null);
    setRevisions(body.revisions || []);
    if (body.latest) {
      setFinalOutcome(body.latest.final_outcome);
      setDefinitionOfDone(body.latest.definition_of_done);
      setNextAction(body.latest.next_action);
    }
  }

  useEffect(() => {
    load().catch((err) => setError(err instanceof Error ? err.message : "Failed to load Blueprint"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.missionId]);

  function initialStages(): BlueprintStage[] {
    return [
      {
        stage_id: "STAGE-1",
        order: 1,
        title: "Deliver and verify outcome",
        objective: finalOutcome || props.desiredOutcome || "Complete the approved mission outcome",
        outputs: ["Verified mission deliverable"],
        dependencies: [],
        entry_criteria: ["Blueprint approved"],
        exit_criteria:
          props.successCriteria && props.successCriteria.length > 0
            ? props.successCriteria
            : ["Definition of Done passes with evidence"],
        owner: "aipos_supervisor",
        status: "PLANNED",
        evidence_refs: [],
      },
    ];
  }

  async function saveRevision() {
    setBusy(true);
    setMessage(null);
    setError(null);
    const stages = latest?.stages || initialStages();
    const criticalPath = latest?.critical_path || stages.map((stage) => stage.stage_id);
    const res = await fetch(`/api/missions/${props.missionId}/blueprint`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        final_outcome: finalOutcome,
        definition_of_done: definitionOfDone,
        stages,
        critical_path: criticalPath,
        next_action: nextAction,
      }),
    });
    const body = await res.json();
    setBusy(false);
    if (!res.ok) {
      setError(body?.error?.message || "Failed to save Blueprint");
      return;
    }
    setMessage(`Blueprint revision ${body.blueprint.revision} saved for review`);
    await load();
  }

  async function approveLatest() {
    if (!latest) return;
    setBusy(true);
    setMessage(null);
    setError(null);
    const res = await fetch(`/api/missions/${props.missionId}/blueprint/approve`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ revision: latest.revision }),
    });
    const body = await res.json();
    setBusy(false);
    if (!res.ok) {
      setError(body?.error?.message || "Failed to approve Blueprint");
      return;
    }
    setMessage(`Blueprint revision ${body.blueprint.revision} approved`);
    await load();
  }

  const currentStage =
    latest?.stages.find((stage) => stage.status !== "COMPLETED" && stage.status !== "CANCELLED") ||
    latest?.stages.at(-1);
  const remaining = latest?.stages.filter(
    (stage) => stage.status !== "COMPLETED" && stage.status !== "CANCELLED",
  ).length;

  return (
    <section className="panel space-y-4 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold">Mission Blueprint & Stage Map</h2>
          <p className="text-sm text-[var(--ink-muted)]">
            Dispatch requires the latest persisted Blueprint revision to be explicitly approved.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <span className="badge">revision: {latest?.revision || "—"}</span>
          <span className="badge">status: {latest?.status || "NOT_CREATED"}</span>
          <span className="badge">
            stage: {currentStage?.order || 0}/{latest?.stages.length || 0}
          </span>
          <span className="badge">progress: {latest?.progress.percent || 0}%</span>
        </div>
      </div>

      {error && <p className="text-sm text-[var(--danger)]">{error}</p>}
      {message && <p className="text-sm text-[var(--ok)]">{message}</p>}

      <div className="understanding-grid">
        <div className="space-y-3">
          <div className="field">
            <label htmlFor="blueprint-outcome">Final outcome</label>
            <textarea
              id="blueprint-outcome"
              value={finalOutcome}
              onChange={(event) => setFinalOutcome(event.target.value)}
            />
          </div>
          <div className="field">
            <label htmlFor="blueprint-dod">Definition of Done</label>
            <textarea
              id="blueprint-dod"
              value={definitionOfDone}
              onChange={(event) => setDefinitionOfDone(event.target.value)}
            />
          </div>
          <div className="field">
            <label htmlFor="blueprint-next">Single next executable action</label>
            <textarea
              id="blueprint-next"
              value={nextAction}
              onChange={(event) => setNextAction(event.target.value)}
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <button className="btn btn-secondary" disabled={busy} type="button" onClick={saveRevision}>
              {latest ? "Save new revision" : "Create initial Blueprint"}
            </button>
            <button
              className="btn btn-primary"
              disabled={busy || !latest || latest.status === "APPROVED"}
              type="button"
              onClick={approveLatest}
            >
              Approve latest revision
            </button>
          </div>
        </div>

        <div className="space-y-3">
          <p>
            <strong>Current stage:</strong> {currentStage?.title || "Blueprint not created"}
          </p>
          <p>
            <strong>Remaining stages:</strong> {remaining ?? 0}
          </p>
          <p>
            <strong>Critical path:</strong> {latest?.critical_path.join(" → ") || "—"}
          </p>
          <p>
            <strong>Evidence:</strong> {latest?.progress.evidence_refs.join(", ") || "None yet"}
          </p>
          <div>
            <strong>Revision history</strong>
            <ul className="mt-1 list-disc pl-5 text-sm">
              {revisions.map((revision) => (
                <li key={`${revision.blueprint_id}-${revision.status}`}>
                  R{revision.revision} · {revision.status}
                  {revision.approved_by ? ` · approved by ${revision.approved_by}` : ""}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>

      {latest && (
        <div className="table-wrap">
          <table className="data">
            <thead>
              <tr>
                <th>Stage</th>
                <th>Status</th>
                <th>Owner</th>
                <th>Dependencies</th>
                <th>Exit criteria</th>
                <th>Evidence</th>
              </tr>
            </thead>
            <tbody>
              {latest.stages.map((stage) => (
                <tr key={stage.stage_id}>
                  <td>
                    <strong>
                      {stage.order}. {stage.title}
                    </strong>
                    <div className="text-xs text-[var(--ink-muted)]">{stage.objective}</div>
                  </td>
                  <td>{stage.status}</td>
                  <td>{stage.owner}</td>
                  <td>{stage.dependencies.join(", ") || "—"}</td>
                  <td>{stage.exit_criteria.join("; ")}</td>
                  <td>{stage.evidence_refs.join(", ") || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
