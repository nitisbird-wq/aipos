# AIPOS Phase 3 Delivery Plan — Planning & Assignment (3a)

**Scope:** [PHASE_3_SCOPE.md](./PHASE_3_SCOPE.md)  
**Architecture:** [PHASE_3_ARCHITECTURE.md](./PHASE_3_ARCHITECTURE.md)  
**Acceptance:** [PHASE_3_ACCEPTANCE_CRITERIA.md](./PHASE_3_ACCEPTANCE_CRITERIA.md)  
**ADR:** [ADR-005](../adr/ADR-005-PLANNING-SUBTASK-ASSIGNMENT.md)

---

## 1. Prerequisites

| Gate | Status |
|---|---|
| Human merge of Phase 2 Postgres adapter ([PR #8](https://github.com/nitisbird-wq/aipos/pull/8)) | **DONE** — Phase 2 **PRODUCTION PASS** ([AIPOS CURRENT STATE](https://app.notion.com/p/3cdbc165be4c81c48e73e5899ae5f0e3)) |
| Human approval of ADR-005 (this docs PR) | Required before schema/code PRs |
| ADR-007 Capability Orchestration (Decompose + Route) | **Reserved** — routing implementation blocked until Mission Decomposer approved |
| No Execution/Artifact/Review/Closeout in 3a | Locked |
| Do not modify production Mission Intake n8n (`7fLPHiiyt7sre5RR`) | Locked |

---

## 2. Implementation PR sequence (after docs ADR merge)

| PR | Title (suggested) | Contents | Depends on |
|---|---|---|---|
| **Docs** (this) | `docs: define AIPOS Phase 3 planning architecture` | Scope, architecture, AC, delivery, ADR-005, capability corrections | — |
| **3a.1 Schemas** | `feat: add plan/subtask/assignment schemas` | Zod + JSON Schema; Mission coarse status + `status_before_block`; **no** runtime wiring | ADR-005 |
| **3a.2 Migration** | `feat: add plans/subtasks/assignments tables` | Non-destructive SQL migration; Drizzle mirror | 3a.1 |
| **3a.3 Repository** | `feat: repository methods for plans/subtasks/assignments` | Postgres + file adapter parity + contract tests | 3a.2 |
| **3a.4 Planning commands** | `feat: plan create/submit/approve/reject` | Services + API + audit + actor checks | 3a.3 |
| **3a.5 Subtasks** | `feat: generate L0–L1 subtasks + dependency validation` | From approved plan only | 3a.4 |
| **3a.6 Assignment** | `feat: propose/approve/reject assignment` | Ends at `assignment.approved` | 3a.5 |
| **3a.7 Mission transitions** | `feat: status_before_block unblock restore` | Extend transition rules; cascade cancel | 3a.3+ |
| **3a.8 UI (optional slice)** | `feat: planning/assignment commander UI` | Minimal operator surfaces | 3a.6 |

**Do not** open Execution / n8n / Artifact / Review / Closeout PRs under Phase 3a numbering.

---

## 3. Migration strategy

1. Additive tables only (`CREATE TABLE IF NOT EXISTS` / versioned migrate).  
2. No DROP of Intake MVP tables.  
3. Backfill: none required; plans start empty for existing missions at `ready`.  
4. Expand Mission.status values only after ADR-005 Human approval; keep reading legacy values.  
5. File adapter: extend store shape in lockstep for local tests.  
6. Rollback: feature-flag or disable routes; DB tables may remain empty.

---

## 4. Test strategy

| Layer | What |
|---|---|
| Unit | Transition matrices; actor authorization; version bump on reject |
| Contract | Repository parity file vs Postgres for new aggregates |
| Service | Plan reject → new version; Mission stays active; block/unblock previous state |
| API | Command routes; forbid status PATCH |
| Regression | Existing 46+ Intake/Notion/transition tests must stay green |
| Explicit non-tests in 3a | n8n, artifact review, closeout |

CI: continue PG service pattern from Phase 2 for contract tests.

---

## 5. Documentation updates required with 3a

- Keep [CURRENT_CAPABILITIES.md](./CURRENT_CAPABILITIES.md) Artifact/Review/Closeout = NOT STARTED; Monitoring = PARTIAL/THIN  
- Split roadmap: **Phase 3a** Planning→Assignment; **Phase 3b+** Execution via n8n (separate ADR)  
- API_CONTRACT.md extended only in implementation PRs  

---

## 6. Definition of Done (docs PR)

- [x] Scope / Architecture / AC / Delivery / ADR-005 authored  
- [x] Capability status corrected in CURRENT_CAPABILITIES  
- [x] Notion one-way rule recorded  
- [x] State machines + matrices + open-Q decisions recorded  
- [ ] Human review of ADR-005  
- [ ] No source code / schema migration in this PR  
- [ ] No auto-merge  

---

## 7. Open risks

| Risk | Mitigation |
|---|---|
| Mission.status coarse vs UI needing detail | UI reads child aggregates; Mission badge stays coarse |
| Conflict with D2 “auto-run assignment/L0–L1 execute” | 3a requires human approval where policy says; Execution deferred to later ADR that must reconcile D2 |
| Concurrent plan create races | Unique `(mission_id, plan_version)` + idempotency keys |
| Unblock with stale `status_before_block` | Fail closed; require explicit command |
| Dashboard drift again | Treat CURRENT_CAPABILITIES as SSOT for capability traffic lights |
| PR #8 not yet merged | Block implementation PRs until Postgres foundation is on `main` |

---

## 8. Recommended next Human actions

1. Merge or explicitly defer [PR #8](https://github.com/nitisbird-wq/aipos/pull/8).  
2. Review & approve ADR-005 in this PR.  
3. Only then authorize **3a.1** schema PR.  
