# AIPOS Phase 3 Acceptance Criteria — Planning & Assignment (3a)

**Scope:** [PHASE_3_SCOPE.md](./PHASE_3_SCOPE.md)  
**Architecture:** [PHASE_3_ARCHITECTURE.md](./PHASE_3_ARCHITECTURE.md)  
**ADR:** [ADR-005](../adr/ADR-005-PLANNING-SUBTASK-ASSIGNMENT.md)

These criteria apply to **future implementation PRs**. This docs branch does not implement them.

---

## A. Preconditions

| ID | Criterion |
|---|---|
| P3-A1 | Mission exists with `status=ready` (ready_for_planning) after Intake confirm |
| P3-A2 | App DB (PostgreSQL) is runtime SSOT; file adapter may be used only in local/dev tests with explicit adapter name |
| P3-A3 | Actor for approve/reject is `operator:*` — ChatGPT/assistant actors are rejected |

---

## B. Plan lifecycle

| ID | Criterion |
|---|---|
| P3-B1 | `plan_create` creates `draft` with monotonic `plan_version` per mission |
| P3-B2 | Same Idempotency-Key on create does not create a duplicate version |
| P3-B3 | `plan_submit` moves `draft` → `awaiting_approval` and emits audit |
| P3-B4 | `plan_approve` (operator) moves to `approved`; ChatGPT approve fails `ACTOR_NOT_AUTHORIZED` |
| P3-B5 | `plan_reject` marks plan `rejected` (or superseded per policy); Mission remains **active** (does not return to `ready`) |
| P3-B6 | After reject, `plan_create` yields version N+1 `draft`; version N remains readable in history |
| P3-B7 | Direct `PATCH` plan status is impossible (no route / rejected) |

---

## C. Subtasks (L0–L1)

| ID | Criterion |
|---|---|
| P3-C1 | Subtasks generate only from an **approved** plan |
| P3-C2 | Only L0–L1 risk subtasks in 3a; L2+ requires escalation / out of scope |
| P3-C3 | Dependency validation fails closed (cycle or missing dep → no `ready`) |
| P3-C4 | No execution states required for 3a DoD |

---

## D. Assignment (3a end)

| ID | Criterion |
|---|---|
| P3-D1 | Assignment may be proposed for `ready` subtasks |
| P3-D2 | Where policy requires, assignment stays `awaiting_approval` until operator approve |
| P3-D3 | `assignment_approve` → `approved` ends Phase 3a happy path |
| P3-D4 | Reject returns to re-propose path without inventing execution |
| P3-D5 | No n8n dispatch, no artifact creation, no review/closeout as part of 3a |

---

## E. Mission coarse status & block

| ID | Criterion |
|---|---|
| P3-E1 | `plan_start` moves Mission `ready` → `active` |
| P3-E2 | `mission_block` stores `status_before_block` |
| P3-E3 | `mission_unblock` restores previous valid state (not always `ready`) |
| P3-E4 | `mission_cancel` → `cancelled`; children cascade to cancelled; audit trail retained (no hard delete) |

---

## F. Audit & idempotency

| ID | Criterion |
|---|---|
| P3-F1 | Every successful/failed command transition appends audit with actor, reason, correlation_id, previous/new state, policy_result |
| P3-F2 | Replayed idempotent commands do not duplicate side effects (plan versions, assignments) |
| P3-F3 | Cancel mid-flight produces correlated audit for mission + affected children |

---

## G. Notion

| ID | Criterion |
|---|---|
| P3-G1 | No code path writes Notion→runtime Plan/Subtask/Assignment state |
| P3-G2 | Optional projection remains App→Notion; readback metadata only |

---

## H. Explicit non-criteria (out of 3a)

| ID | Not required |
|---|---|
| P3-H1 | Execution job success/failure |
| P3-H2 | Artifact store / approve-reject of results |
| P3-H3 | Closeout / learned_prefs |
| P3-H4 | Production monitoring / alerting |

---

## Definition of Done (Phase 3a implementation — future)

- All P3-A…G criteria have automated tests (Vitest; PG contract where applicable)  
- Doctor Critical=0 on PR profile  
- No Architecture Contract silent break; ADR-005 approved before schema enum expansion  
- Capability docs still show Artifact/Review/Closeout as NOT STARTED; Monitoring PARTIAL/THIN  
