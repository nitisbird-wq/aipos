# AIPOS Control Tower v1 — Guard & Connection Matrix

| Field | Value |
|---|---|
| **Document** | `CONTROL_TOWER_GUARD_MATRIX` |
| **Version** | `1.0.0` |
| **Status** | `Draft — awaiting Human Architecture Approval` |
| **Date** | `2026-08-07` |

---

## Guard matrix

| Guard | Rule (examples) | Severity | Evidence | Allow | Warn | Block | Human Gate |
|---|---|---|---|---|---|---|---|
| ArchitectureGuard | n8n declared as SSOT | critical | registry / diff / docs claim | — | — | yes | ADR + Human if disputed |
| ArchitectureGuard | Notion mutates mission runtime | critical | code path / sync direction | — | — | yes | — |
| ArchitectureGuard | AI approves human gate | critical | actor / transition audit | — | — | yes | — |
| ArchitectureGuard | Architecture Contract change without ADR | critical | diff vs `adr/` | — | — | yes | new ADR |
| ArchitectureGuard | Compliant Core-owned gate change with ADR | medium | ADR id + diff | yes | — | — | if ADR Proposed |
| ScopeGuard | File outside approved mission paths | high | `git diff` vs scope file | — | rare | yes | scope amendment |
| ScopeGuard | Phase 3a touches execution/n8n/review/closeout | critical | phase config + paths | — | — | yes | phase ADR |
| ScopeGuard | Docs-only PR contains `apps/**` source | high | PR files | — | — | yes | — |
| ScopeGuard | Change inside declared allowed paths | low | diff | yes | — | — | — |
| DependencyGuard | Required PR not ancestor of `origin/main` | critical | `gh` + `merge-base --is-ancestor` | — | — | yes | — |
| DependencyGuard | Trust MERGED label without graph check | critical | (anti-pattern) | — | — | yes | — |
| DependencyGuard | Schema/migration/ADR dep missing | high | versions / files | — | sometimes | yes | — |
| GitGuard | Commit directly on `main` | high | branch name | — | policy | yes (agents) | Human hotfix only |
| GitGuard | Force-push | critical | reflog / policy | — | — | yes | — |
| GitGuard | Wrong PR base / stale behind main | medium | `gh` / commits behind | — | yes | if policy | — |
| GitGuard | Branch naming / dirty tree for release | low–medium | git status | yes | yes | — | — |
| DatabaseGuard | Destructive migration (DROP/TRUNCATE data) | critical | SQL diff | — | — | default | ADR + Human |
| DatabaseGuard | Missing unique/FK for known race | high | schema review | — | yes | if known CVE-class | — |
| DatabaseGuard | Safe additive migration + tests | medium | migration + test | yes | — | — | — |
| StateGuard | `ready` → `executing` without plan/assign/approve | critical | transition matrix | — | — | yes | — |
| StateGuard | Valid command transition with audit fields | medium | audit event | yes | — | — | if L3–L4 |
| StateGuard | Direct status PATCH | critical | API route / diff | — | — | yes | — |
| SecurityGuard | Commit `.env` / token / private key | critical | gitleaks / patterns | — | — | yes | — |
| SecurityGuard | Log/print secret values | critical | report scan | — | — | yes | — |
| SecurityGuard | Prod URL in default local config | high | config | — | yes | if write | — |
| IntegrationGuard | Notion `runtime_ssot=true` or inbound mutate | critical | registry | — | — | yes | — |
| IntegrationGuard | n8n `authority` ≠ execution_adapter / SSOT true | critical | registry | — | — | yes | — |
| IntegrationGuard | Postgres `runtime_ssot=true` | info | registry | yes | — | — | — |
| IntegrationGuard | Connection not configured for phase | low | health | — | N/A or WARN | — | — |
| AIAgentGuard | Agent expands own scope | critical | tool transcript / diff | — | — | yes | — |
| AIAgentGuard | Agent auto-merges high-impact PR | critical | gh events | — | — | yes | — |
| AIAgentGuard | Agent action with mission/req/scope/correlation | medium | context object | yes | — | — | when required |
| QualityGuard | Missing format/lint/test/build/doctor/secret | high | CI / local | — | — | yes in PR profile | — |
| QualityGuard | DB change without migration test | high | diff + tests | — | — | yes | — |
| QualityGuard | API change without API test | high | diff + tests | — | — | yes | — |
| CostGuard | Missing cost telemetry fields | low | optional | N/A | yes | — | — |
| RuntimeGuard | Postgres DOWN while FORCE_POSTGRES | high | health query | — | DEGRADED | if required | — |
| RuntimeGuard | Docker/n8n NOT_CONFIGURED | low | probe | N/A | — | **not** critical by default | — |

---

## Connection matrix

| System | Direction | Authority | SSOT (runtime) | Write | Health | Phase |
|---|---|---|---|---|---|---|
| github | tool ↔ GitHub API | code/CI SoT tooling | false* | via PR | CI/`gh` | all |
| postgres | app ↔ DB | runtime store | **true** | yes | safe `SELECT 1` / migrate status | Phase 2+ |
| notion | **outbound** App → Notion | projection / knowledge display | **false** | projection + verify meta | mock / config / safe API | MVP+ |
| n8n | app → adapter → signed callback | **execution_adapter** | **false** | execution when allowed | health endpoint | post-3a |
| docker | local engine | env tooling | false | n/a | `docker info` / compose ps | optional |
| openai | app → provider | analyze/draft | false | no mission authority | config presence only | optional |
| cursor | agent IDE/cloud | code assistant | false | via branches/PRs | N/A | all agent work |
| bruno | collections → API | test tooling | false | n/a | files present | optional |

\*GitHub contents are SSOT for **code/ADR/CI artifacts**, not application runtime transactions.

### Registry record fields (CT-2)

Each Connection Registry entry:

`system`, `purpose`, `direction`, `authority`, `environment`, `authentication_type`, `write_allowed`, `runtime_ssot`, `health_check`, `required_for_phase`, `owner`, `status`

---

## Runtime health statuses

`HEALTHY` | `DEGRADED` | `DOWN` | `NOT_CONFIGURED`

Categories: GitHub, PostgreSQL, Docker, n8n, Notion, AI provider, API, CI.

---

## Overall aggregation reminder

Any **Critical BLOCK** → Overall **BLOCKED**.  
Else weighted score per [CONTROL_TOWER_ARCHITECTURE.md](./CONTROL_TOWER_ARCHITECTURE.md).
