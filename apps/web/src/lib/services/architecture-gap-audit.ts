/**
 * Architecture gap audit — additive control-plane pass (no second SoT).
 *
 * Legend: PRESENT = implemented in runtime; DEFERRED = documented backlog only;
 * PARTIAL = contract/hooks exist without full operationalization.
 */

export type GapStatus = "PRESENT" | "PARTIAL" | "DEFERRED";

export type ArchitectureGap = {
  id: string;
  area: string;
  status: GapStatus;
  notes: string;
  soT_boundary: string;
};

export const ARCHITECTURE_GAP_AUDIT: ArchitectureGap[] = [
  {
    id: "GAP-GOV-LIFECYCLE",
    area: "Governance lifecycle / version / supersession / rollback",
    status: "DEFERRED",
    notes: "Tracked in docs/GOVERNANCE_V1_BACKLOG.md (G-V1-01..03). No second registry invented.",
    soT_boundary: "Git/GitHub owns ADR + contracts; Notion projects human registry only.",
  },
  {
    id: "GAP-DATA-CLASS",
    area: "Data classification and retention",
    status: "PARTIAL",
    notes:
      "Intake bundle schema includes data_classification + retention_days; enforcement hooks remain Phase-later.",
    soT_boundary: "Postgres owns runtime mission/intake records.",
  },
  {
    id: "GAP-SOURCE-CONFLICT",
    area: "Source conflict resolution",
    status: "PARTIAL",
    notes:
      "ContextObject.conflicts_with + freshness fields exist; Health Supervisor flags stale evidence.",
    soT_boundary: "Canonical decisions stay in app DB control-plane state.",
  },
  {
    id: "GAP-CONNECTOR-PRIV",
    area: "Connector least privilege / consent / exfiltration / audit",
    status: "PARTIAL",
    notes:
      "Linear/Notion adapters default mock; live requires explicit env; audit events append-only.",
    soT_boundary: "External systems are projections/trackers, never SoT.",
  },
  {
    id: "GAP-BACKUP-OBS",
    area: "Backup / observability / cost / incident response",
    status: "DEFERRED",
    notes: "No production deploy from agents; ops runbooks remain outside this PR.",
    soT_boundary: "Git owns runbooks when added; runtime incidents recorded as blockers/audit.",
  },
  {
    id: "GAP-KNOWLEDGE-FRESH",
    area: "Knowledge freshness / stale blocking",
    status: "PARTIAL",
    notes: "Health Supervisor emits stale evidence/mission findings with remediation.",
    soT_boundary: "Freshness judged against control-plane evidence timestamps.",
  },
  {
    id: "GAP-EVAL-HARNESS",
    area: "Evaluation harness",
    status: "PARTIAL",
    notes: "Golden continuity + control-plane E2E tests present; broader eval harness deferred.",
    soT_boundary: "Tests live in Git; results are CI evidence, not a second mission store.",
  },
];

export function gapsNeedingImplementation(): ArchitectureGap[] {
  return ARCHITECTURE_GAP_AUDIT.filter((g) => g.status !== "PRESENT");
}
