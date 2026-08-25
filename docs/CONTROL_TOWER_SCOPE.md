# AIPOS Control Tower v1 — Scope

| Field | Value |
|---|---|
| **Document** | `CONTROL_TOWER_SCOPE` |
| **Version** | `1.0.0` |
| **Status** | `Approved — CT-1 architecture approved 2026-08-25; CT-2 enforcement MVP authorized` |
| **Date** | `2026-08-07` |
| **Binding ADR** | [ADR-006](../adr/ADR-006-AIPOS-CONTROL-TOWER.md) |
| **Delivery** | CT-1 = docs/ADR only; CT-2 = enforcement MVP (separate PR) |

---

## Purpose

AIPOS Control Tower is the **governance + control plane enforcement system** for Nitis Pro AIPOS. It exists to prevent AI agents, automation, and humans-from-rushing from:

- drifting off mission objective
- skipping dependencies
- expanding or mutating scope without approval
- changing architecture without ADR
- assigning wrong authority to integrations (Notion, n8n, AI providers)
- claiming Verified / Connected / Authorized without evidence

Control Tower is **not** a dashboard-only product. A dashboard may later surface decisions; enforcement is primary.

---

## In scope (Control Tower v1)

| Domain | Control Tower responsibility |
|---|---|
| Architecture / ADR | ArchitectureGuard — contract + ADR presence for architecture impact |
| Mission / Requirement | Context resolve — every high-impact action binds mission_id + requirement_id when available |
| Scope | ScopeGuard — allowed/excluded paths vs phase + PR declared scope |
| Git / Branch / PR | GitGuard — no direct main work; naming; base; stale; no force-push policy |
| Dependency | DependencyGuard — required PRs **and** ancestor-of-`origin/main` graph checks (`gh` + `git`) |
| PostgreSQL / Migration | DatabaseGuard — destructive migration, uniqueness, transaction, rollback notes |
| API | QualityGuard / ScopeGuard — API path changes require tests |
| Security / Secret | SecurityGuard — never print secret values; block credential commits |
| AI Agents / Cursor | AIAgentGuard — block self-scope-expand, silent locked-decision change, auto-merge |
| GitHub | Connection + status SoT via `gh` |
| Docker / n8n / Notion / OpenAI | IntegrationGuard + RuntimeGuard — registry roles + health categories |
| Tests / CI | QualityGuard — format/lint/test/build/doctor/secret scan (+ migration/API when touched) |
| Runtime health | RuntimeGuard — HEALTHY / DEGRADED / DOWN / NOT_CONFIGURED |
| Cost / Usage | CostGuard — telemetry schema; optional in v1 implementation |
| Audit / Evidence | Evidence Engine — decisions + report artifact (gitignored in CT-2) |

---

## Out of scope (v1)

| Item | Reason |
|---|---|
| Multi-Agent Orchestration / G0–G5 full product redesign | Phase 3+ / Hard Control product work — not Control Tower |
| n8n execution runtime | Execution adapter later; registry may mark NOT_CONFIGURED |
| Bidirectional Notion sync | Forbidden by Architecture Contract / ADR-005 / ADR-006 |
| Auto-merge of PRs | Human remains final authority |
| Production deploy / secret rotation | Explicit human + target required |
| Replacing AIPOS Doctor | Reuse Doctor; Control Tower adds enforcement profile |
| Large new UI product | CLI first; optional thin Control Center surface in CT-2 if structure exists |
| Changing Architecture Contract text without ADR | Forbidden |
| Mission business-logic redesign | Forbidden in Control Tower PRs |

---

## Delivery split

### CT-1 — Architecture (this PR family)

- Docs listed in ADR-006
- Decision model, guard matrix, connection matrix, lifecycle, readiness score
- **No application source code**

### CT-2 — Enforcement MVP (after Human approval of CT-1)

- CLI: `control`, `control:status`, `control:check`, `control:connections`, `control:evidence`
- Guards as executable policy checks
- CI PR profile (fail only on BLOCKED/Critical)
- Local report `AIPOS_CONTROL_TOWER_REPORT.md` (gitignored)
- Optional minimal dashboard extension only if Developer Control Center already landed

---

## Repository reality (binding at CT-1 authoring)

Verified via `gh` / `git` (do not use agent memory):

| PR | State | Note for Control Tower |
|---|---|---|
| #8 Postgres runtime adapter | **MERGED** to `main` | Runtime SSOT adapter available (opt-in) |
| #9 Phase 3 planning docs | **MERGED** to `main` | Phase context 3a docs exist |
| #10 PG transactional hardening | **MERGED** but base ≠ `main` ancestry | **Not** on `origin/main`; DependencyGuard must use ancestor graph |
| #11 Developer Control Center | **OPEN** (Secret scan failed) | Not required for CT-1; CT-2 may integrate if merged |

CT-1 branch base: **`origin/main`**.

---

## Success definition

Human can approve ADR-006 + these docs and then authorize CT-2 knowing:

1. What is enforced vs observed
2. Which guards are Critical
3. How ALLOW / WARN / BLOCK / HUMAN_APPROVAL_REQUIRED / NOT_APPLICABLE work
4. How Notion / n8n / Postgres / AI authority is fixed in the Connection Registry
5. That Control Tower must run before high-impact agent actions
