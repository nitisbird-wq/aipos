import { getRepository } from "@/lib/repositories";
import { getMissionControlState } from "@/lib/services/control-plane-state";

export type HealthStatus = "HEALTHY" | "WARNING" | "BLOCKED" | "CRITICAL";

export type HealthCheckResult = {
  mission_id: string;
  status: HealthStatus;
  findings: string[];
  remediation: string[];
};

/** Waiting-human SLA before escalating WARNING → BLOCKED (ms). */
export const WAITING_HUMAN_SLA_MS = 1000 * 60 * 60 * 4;

/** Evidence/context considered stale after this age (ms). */
export const STALE_EVIDENCE_MS = 1000 * 60 * 60 * 24;

function ageMs(iso: string): number {
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return Number.POSITIVE_INFINITY;
  return Date.now() - t;
}

export async function evaluateMissionHealth(missionId: string): Promise<HealthCheckResult> {
  const repo = getRepository();
  const state = await getMissionControlState(missionId);
  const findings: string[] = [];
  const remediation: string[] = [];

  const staleMs = ageMs(state.updated_at);
  if (staleMs > 1000 * 60 * 60) {
    findings.push("stale mission state");
    remediation.push("Trigger supervisor reassessment and refresh handoff");
  }

  const ids = state.workstreams.map((row) => row.workstream_id);
  const duplicates = ids.filter((id, index) => ids.indexOf(id) !== index);
  if (duplicates.length > 0) {
    findings.push(`duplicate workstream: ${Array.from(new Set(duplicates)).join(", ")}`);
    remediation.push("Reconcile duplicated workstream IDs and keep canonical row");
  }

  const dispatchedNoHandoff = state.workstreams
    .filter((row) => ["DISPATCHED", "WORKER_READY", "EXECUTING", "VERIFYING"].includes(row.status))
    .filter(
      (row) => !state.handoffs.some((handoff) => handoff.workstream_id === row.workstream_id),
    );
  if (dispatchedNoHandoff.length > 0) {
    findings.push("missing handoff for active workstream");
    remediation.push("Collect mandatory handoff payload from worker run");
  }

  const failedExecution = state.workstreams.filter((row) => row.status === "FAILED");
  if (failedExecution.length > 0) {
    findings.push("failed execution detected");
    remediation.push("Create recovery task (retry/reroute/reconcile/rollback/escalate)");
  }

  const notion = await repo.getNotionSync(missionId);
  if (notion && notion.sync_status === "failed") {
    findings.push("inconsistent notion projection state");
    remediation.push("Retry sync and verify readback before external claim");
  }

  const orphanLinear = state.workstreams.filter(
    (row) => row.status === "DISPATCHED" && !row.linear_issue_id,
  );
  if (orphanLinear.length > 0) {
    findings.push("orphan linear issue reference");
    remediation.push("Run dispatcher reconcile to repair external mapping");
  }

  const divergentMapping = state.workstreams.filter(
    (row) => row.linear_issue_id && row.status === "PENDING",
  );
  if (divergentMapping.length > 0) {
    findings.push("state divergence: linear mapping present while workstream still PENDING");
    remediation.push("Reconcile workstream status to DISPATCHED or clear stale linear_issue_id");
  }

  const waitingHuman = state.blockers.filter((row) => row.requires_human && !row.resolved);
  const waitingHumanOverSla = waitingHuman.filter(
    (row) => ageMs(row.opened_at) > WAITING_HUMAN_SLA_MS,
  );
  if (waitingHuman.length > 0 && waitingHumanOverSla.length === 0) {
    findings.push("waiting-human blocker within SLA");
    remediation.push("Prepare owner approval package before SLA breach");
  }
  if (waitingHumanOverSla.length > 0) {
    findings.push("waiting-human blockers over SLA");
    remediation.push("Escalate to owner with explicit approval package");
  }

  const staleEvidence = state.handoffs.some((handoff) =>
    handoff.evidence.some(
      (ev) =>
        ev.freshness === "stale" ||
        (typeof ev.timestamp === "string" && ageMs(ev.timestamp) > STALE_EVIDENCE_MS),
    ),
  );
  if (staleEvidence) {
    findings.push("stale evidence attached to handoff");
    remediation.push("Re-collect evidence and re-verify before treating claims as current");
  }

  const completedNoArtifact = state.workstreams
    .filter((row) => row.status === "COMPLETED")
    .filter(
      (row) =>
        !state.artifacts.some((artifact) => artifact.workstream_id === row.workstream_id) ||
        !state.verifications.some(
          (verification) =>
            verification.workstream_id === row.workstream_id && verification.status === "PASS",
        ),
    );
  if (completedNoArtifact.length > 0) {
    findings.push("completed workstream without artifact/result");
    remediation.push("Require artifact upload and verifier pass before marking completed");
  }

  let status: HealthStatus = "HEALTHY";
  if (findings.length > 0) status = "WARNING";
  if (failedExecution.length > 0 || waitingHumanOverSla.length > 0 || orphanLinear.length > 0) {
    status = "BLOCKED";
  }
  if (duplicates.length > 0 || completedNoArtifact.length > 0 || divergentMapping.length > 0) {
    status = "CRITICAL";
  }

  return {
    mission_id: missionId,
    status,
    findings,
    remediation,
  };
}

/** Continuous health scan across missions in the runtime store. */
export async function evaluateAllMissionsHealth(): Promise<HealthCheckResult[]> {
  const repo = getRepository();
  const missions = await repo.listMissions();
  const results: HealthCheckResult[] = [];
  for (const mission of missions) {
    results.push(await evaluateMissionHealth(mission.mission_id));
  }
  return results;
}
