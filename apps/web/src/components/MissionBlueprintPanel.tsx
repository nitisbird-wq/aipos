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

const STAGE_STATUSES = [
  "PLANNED",
  "READY",
  "IN_PROGRESS",
  "BLOCKED",
  "VERIFYING",
  "COMPLETED",
  "CANCELLED",
] as const;

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

// prettier-ignore
export function MissionBlueprintPanel(props: {
  missionId: string;
  desiredOutcome?: string;
  successCriteria?: string[];
}) {
  const [latest, setLatest] = useState<Blueprint | null>(null);
  const [revisions, setRevisions] = useState<Blueprint[]>([]);
  const [draftStages, setDraftStages] = useState<BlueprintStage[]>([]);
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
      setDraftStages(body.latest.stages);
    } else {
      setDraftStages(initialStages());
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

  function updateStage<K extends keyof BlueprintStage>(
    index: number,
    key: K,
    value: BlueprintStage[K],
  ) {
    setDraftStages((current) =>
      current.map((stage, stageIndex) =>
        stageIndex === index ? { ...stage, [key]: value } : stage,
      ),
    );
  }

  function moveStage(index: number, direction: -1 | 1) {
    setDraftStages((current) => {
      const destination = index + direction;
      if (destination < 0 || destination >= current.length) return current;
      const reordered = [...current];
      [reordered[index], reordered[destination]] = [
        reordered[destination]!,
        reordered[index]!,
      ];
      return reordered.map((stage, stageIndex) => ({ ...stage, order: stageIndex + 1 }));
    });
  }

  function addStage() {
    setDraftStages((current) => {
      const usedIds = new Set(current.map((stage) => stage.stage_id));
      let suffix = current.length + 1;
      while (usedIds.has(`STAGE-${suffix}`)) suffix += 1;
      const previous = current.at(-1);
      return [
        ...current,
        {
          stage_id: `STAGE-${suffix}`,
          order: current.length + 1,
          title: "New stage",
          objective: "Define the stage objective",
          outputs: ["Verified stage output"],
          dependencies: previous ? [previous.stage_id] : [],
          entry_criteria: previous ? [`${previous.stage_id} completed`] : ["Blueprint approved"],
          exit_criteria: ["Exit criteria passes with evidence"],
          owner: "aipos_supervisor",
          status: "PLANNED",
          evidence_refs: [],
        },
      ];
    });
  }

  function removeStage(index: number) {
    setDraftStages((current) => {
      if (current.length <= 1) return current;
      const removedId = current[index]?.stage_id;
      return current
        .filter((_, stageIndex) => stageIndex !== index)
        .map((stage, stageIndex) => ({
          ...stage,
          order: stageIndex + 1,
          dependencies: stage.dependencies.filter((dependency) => dependency !== removedId),
        }));
    });
  }

  async function saveRevision() {
    setBusy(true);
    setMessage(null);
    setError(null);
    const stages = draftStages.length > 0 ? draftStages : initialStages();
    const criticalPath = stages.map((stage) => stage.stage_id);
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

      <div className="space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <strong>Editable stage map</strong>
            <p className="text-xs text-[var(--ink-muted)]">
              Changes remain a draft until saved as a new revision and explicitly approved.
            </p>
          </div>
          <button className="btn btn-secondary" disabled={busy} type="button" onClick={addStage}>
            Add stage
          </button>
        </div>
        <div className="table-wrap">
          <table className="data">
            <thead>
              <tr>
                <th>Order</th>
                <th>Stage and objective</th>
                <th>Status and owner</th>
                <th>Contracts</th>
                <th>Evidence</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {draftStages.map((stage, index) => (
                <tr key={stage.stage_id}>
                  <td>
                    <strong>
                      {stage.order}. {stage.stage_id}
                    </strong>
                  </td>
                  <td>
                    <input
                      aria-label={`${stage.stage_id} title`}
                      value={stage.title}
                      onChange={(event) => updateStage(index, "title", event.target.value)}
                    />
                    <textarea
                      aria-label={`${stage.stage_id} objective`}
                      value={stage.objective}
                      onChange={(event) => updateStage(index, "objective", event.target.value)}
                    />
                  </td>
                  <td>
                    <select
                      aria-label={`${stage.stage_id} status`}
                      value={stage.status}
                      onChange={(event) => updateStage(index, "status", event.target.value)}
                    >
                      {STAGE_STATUSES.map((status) => (
                        <option key={status} value={status}>
                          {status}
                        </option>
                      ))}
                    </select>
                    <input
                      aria-label={`${stage.stage_id} owner`}
                      value={stage.owner}
                      onChange={(event) => updateStage(index, "owner", event.target.value)}
                    />
                  </td>
                  <td>
                    <input
                      aria-label={`${stage.stage_id} outputs`}
                      value={stage.outputs.join(", ")}
                      onChange={(event) =>
                        updateStage(
                          index,
                          "outputs",
                          event.target.value.split(",").map((value) => value.trim()).filter(Boolean),
                        )
                      }
                    />
                    <input
                      aria-label={`${stage.stage_id} dependencies`}
                      value={stage.dependencies.join(", ")}
                      onChange={(event) =>
                        updateStage(
                          index,
                          "dependencies",
                          event.target.value.split(",").map((value) => value.trim()).filter(Boolean),
                        )
                      }
                    />
                    <input
                      aria-label={`${stage.stage_id} entry criteria`}
                      value={stage.entry_criteria.join("; ")}
                      onChange={(event) =>
                        updateStage(
                          index,
                          "entry_criteria",
                          event.target.value.split(";").map((value) => value.trim()).filter(Boolean),
                        )
                      }
                    />
                    <input
                      aria-label={`${stage.stage_id} exit criteria`}
                      value={stage.exit_criteria.join("; ")}
                      onChange={(event) =>
                        updateStage(
                          index,
                          "exit_criteria",
                          event.target.value.split(";").map((value) => value.trim()).filter(Boolean),
                        )
                      }
                    />
                  </td>
                  <td>
                    <input
                      aria-label={`${stage.stage_id} evidence references`}
                      value={stage.evidence_refs.join(", ")}
                      onChange={(event) =>
                        updateStage(
                          index,
                          "evidence_refs",
                          event.target.value.split(",").map((value) => value.trim()).filter(Boolean),
                        )
                      }
                    />
                  </td>
                  <td>
                    <div className="flex flex-wrap gap-1">
                      <button
                        aria-label={`Move ${stage.stage_id} up`}
                        className="btn btn-secondary"
                        disabled={busy || index === 0}
                        type="button"
                        onClick={() => moveStage(index, -1)}
                      >
                        ↑
                      </button>
                      <button
                        aria-label={`Move ${stage.stage_id} down`}
                        className="btn btn-secondary"
                        disabled={busy || index === draftStages.length - 1}
                        type="button"
                        onClick={() => moveStage(index, 1)}
                      >
                        ↓
                      </button>
                      <button
                        aria-label={`Remove ${stage.stage_id}`}
                        className="btn btn-secondary"
                        disabled={busy || draftStages.length <= 1}
                        type="button"
                        onClick={() => removeStage(index)}
                      >
                        Remove
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
