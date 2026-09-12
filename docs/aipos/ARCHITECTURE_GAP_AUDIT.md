# Architecture Gap Audit (Control Plane pass)

Additive audit only — **no second source of truth**.

| ID                  | Area                                                       | Status   | Notes                                    |
| ------------------- | ---------------------------------------------------------- | -------- | ---------------------------------------- |
| GAP-GOV-LIFECYCLE   | Governance lifecycle / version / supersession / rollback   | DEFERRED | `docs/GOVERNANCE_V1_BACKLOG.md`          |
| GAP-DATA-CLASS      | Data classification and retention                          | PARTIAL  | Schema fields exist; enforcement later   |
| GAP-SOURCE-CONFLICT | Source conflict resolution                                 | PARTIAL  | `conflicts_with` + health stale checks   |
| GAP-CONNECTOR-PRIV  | Connector least privilege / consent / exfiltration / audit | PARTIAL  | Mock-default adapters; audit append-only |
| GAP-BACKUP-OBS      | Backup / observability / cost / incident response          | DEFERRED | No prod deploy from agents               |
| GAP-KNOWLEDGE-FRESH | Knowledge freshness / stale blocking                       | PARTIAL  | Health Supervisor findings               |
| GAP-EVAL-HARNESS    | Evaluation harness                                         | PARTIAL  | Continuity + control-plane E2E tests     |

Runtime mirror: `apps/web/src/lib/services/architecture-gap-audit.ts`
