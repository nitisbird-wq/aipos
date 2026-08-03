# AIPOS Phase 3 Architecture — Planning & Assignment (3a)

**Status:** Draft for Human approval via ADR-005  
**Scope:** [PHASE_3_SCOPE.md](./PHASE_3_SCOPE.md)  
**ADR:** [ADR-005](../adr/ADR-005-PLANNING-SUBTASK-ASSIGNMENT.md)

---

## 1. Architecture diagram

```text
┌─────────────────────────────────────────────────────────────────┐
│                        AIPOS Core                                │
│  Intake → Confirm → Mission → Planning → Assignment              │
│  (+ later: Execution → Artifact → Review → Closeout)             │
│                                                                  │
│  Governance: Policy / Risk / Audit / Idempotency / Gates         │
└───────────────┬─────────────────────────────┬────────────────────┘
                │                             │
                ▼                             ▼
        ┌───────────────┐             ┌───────────────┐
        │  App Database │             │ Notion Adapter│
        │  PostgreSQL   │ ──project──▶│ (read-only    │
        │  runtime SSOT │   outbound  │  from Notion  │
        └───────────────┘             │  for runtime) │
                ▲                     └───────────────┘
                │ commands only
        ┌───────┴────────┐
        │ Operator / UI  │   ChatGPT may draft; User approves
        └────────────────┘

Later (NOT 3a):
        AIPOS Core ──dispatch──▶ n8n Adapter ──▶ external systems
                     (adapter only; Core remains authority)
```

### Layering

| Layer | Responsibility in 3a |
|---|---|
| Intake / Confirm / Mission | Existing MVP (unchanged semantics) |
| Planning Service | Draft/approve/reject/supersede plans; spawn L0–L1 subtasks |
| Assignment Service | Propose + approve assignments; no dispatch |
| Governance | Policy checks, risk L0–L1 bounds, audit, idempotency |
| App DB | Owns all runtime aggregates |
| Notion | Projection of registry fields only |
| n8n | **Boundary documented; no runtime in 3a** |

---

## 2. Source-of-truth & Notion one-way rule

| Data class | SSOT | Notion role |
|---|---|---|
| Mission / Plan / Subtask / Assignment runtime state | **PostgreSQL** | Projection only (optional) |
| Audit events | **PostgreSQL** | None (or summary later) |
| Operator Identity/Role knowledge | Notion (human) | Future profile **cache** = separate aggregate + ADR |
| Architecture / schemas / ADRs | GitHub | — |

**Forbidden:** Notion edit, webhook, poll, or import that mutates Mission / Plan / Subtask / Assignment / Execution state in App DB.  
**Allowed:** App→Notion write; readback of `notion_page_id` / sync metadata only.

---

## 3. Separate state machines (do not collapse)

Detailed lifecycle lives in child aggregates. **Mission.status stays coarse-grained.**

### 3.1 Mission.status (proposed for ADR; coarse)

| State | Meaning |
|---|---|
| `ready` | **ready_for_planning** (locked semantic; do not rename) |
| `active` | Planning and/or assignment work is underway or completed through assignment |
| `blocked` | Temporarily stopped; restore via `status_before_block` |
| `cancelled` | Terminal cancel |
| `closed` | Terminal successful closeout (**not used in 3a**; reserved) |

**Reserved / legacy (keep in schema until ADR cleanup):** `draft`, `understanding` — do not use as post-mapping lifecycle in new 3a paths.

**Intake `ready_to_dispatch`:** unchanged (= ready_to_map). Do not rename.

Mission does **not** mirror every plan/subtask/assignment/execution state.

### 3.2 plan.status

| State | Meaning |
|---|---|
| `draft` | Editable working plan |
| `awaiting_approval` | Submitted for human approve |
| `approved` | Human approved (confirm-once for this version) |
| `rejected` | Human rejected this version |
| `superseded` | Replaced by a newer plan version |

### 3.3 subtask.status (L0–L1 only in 3a)

| State | Meaning |
|---|---|
| `proposed` | Generated from plan; not yet approved set |
| `approved` | Accepted as part of approved plan package |
| `ready` | Dependencies satisfied; eligible for assignment |
| `blocked` | Waiting on dependency or gate |
| `cancelled` | Cancelled with mission or plan supersede |

*(Execution states `in_progress` / `succeeded` / `failed` reserved for post-3a.)*

### 3.4 assignment.status

| State | Meaning |
|---|---|
| `proposed` | System or assistant proposed mapping |
| `awaiting_approval` | Needs human approval (when required by policy/risk) |
| `approved` | Human approved — **Phase 3a end** |
| `rejected` | Human rejected; re-propose |
| `revoked` | Withdrawn (e.g. failure cause / cancel cascade) |

### 3.5 Reserved for later phases (document only)

- `execution_job.status`: `queued` | `running` | `succeeded` | `failed` | `cancelled`  
- `artifact.status`, `review.status` — NOT STARTED  

---

## 4. Transition matrices

### 4.1 Mission (coarse) — Phase 3a relevant

| From | Command | To | Notes |
|---|---|---|---|
| `ready` | `plan_start` | `active` | First draft plan created |
| `active` | `mission_block` | `blocked` | Persist `status_before_block=active` |
| `ready` | `mission_block` | `blocked` | Persist `status_before_block=ready` |
| `blocked` | `mission_unblock` | *(previous)* | Restore `status_before_block`; clear field |
| `ready` / `active` / `blocked` | `mission_cancel` | `cancelled` | Cascade cancel children; audit trail |
| `cancelled` / `closed` | — | ∅ | Terminal |

No direct `PATCH` of status. Unblock **must not** always return to `ready`.

### 4.2 Plan

| From | Command | To | Notes |
|---|---|---|---|
| (none) | `plan_create` | `draft` | New version `N` for mission |
| `draft` | `plan_submit` | `awaiting_approval` | |
| `awaiting_approval` | `plan_approve` | `approved` | Operator only; ChatGPT forbidden |
| `awaiting_approval` | `plan_reject` | `rejected` | Mission stays **active** (planning continues) |
| `rejected` | `plan_create` | `draft` | **New version N+1**; prior stays rejected/superseded |
| `approved` | `plan_supersede` | `superseded` | Only with new version path |
| `draft` / `awaiting_approval` | `plan_cancel` | `cancelled` or supersede | On mission cancel |

**Open Q2 decision (approved):** on `plan_reject`, Mission does **not** return to `ready` by default; remains in planning (`active`).

### 4.3 Subtask (3a)

| From | Command | To |
|---|---|---|
| (none) | `subtask_generate` | `proposed` |
| `proposed` | `subtask_approve_set` | `approved` |
| `approved` | `subtask_mark_ready` | `ready` (deps ok) |
| `*` non-terminal | `subtask_cancel` | `cancelled` |

### 4.4 Assignment (3a ends at approved)

| From | Command | To |
|---|---|---|
| (none) | `assignment_propose` | `proposed` |
| `proposed` | `assignment_submit` | `awaiting_approval` |
| `awaiting_approval` | `assignment_approve` | `approved` (**3a Done**) |
| `awaiting_approval` | `assignment_reject` | `rejected` |
| `rejected` | `assignment_propose` | `proposed` |
| `approved` | `assignment_revoke` | `revoked` (cancel / pre-exec failure later) |

### 4.5 execution_failed (approved policy; **not implemented in 3a**)

When Execution exists later:

1. **Default:** re-enter assignment (`assigning` / keep or re-open assignment toward `approved`) — do not drop to planned unless…  
2. **…failure cause is planning defect** requiring human decision → return toward **planned** / new plan version.

Documented now so Execution ADR must not invent a conflicting default.

---

## 5. `status_before_block` behavior

| Rule | Detail |
|---|---|
| On `mission_block` | Set `status_before_block` to current Mission.status (`ready` or `active`) |
| On `mission_unblock` | Transition to `status_before_block` if still valid; else fail closed and require explicit command |
| After unblock | Clear `status_before_block` |
| Cancel while blocked | `cancelled`; clear field; audit both |

MVP today only restores `blocked→ready`. Phase 3 **replaces** that with previous-state restore (implementation PR; this doc locks intent).

---

## 6. Plan versioning on rejection

```text
plan v1 awaiting_approval
  → plan_reject → v1 rejected
  → plan_create → v2 draft
  → … approve → v2 approved
  → v1 remains rejected (or marked superseded if policy prefers)
Mission.status stays active throughout
```

Idempotency key recommendation: `(mission_id, plan_version)` unique in App DB.

---

## 7. Data model proposal (App DB — design only; no migration in this branch)

| Table (proposed) | Key fields |
|---|---|
| `plans` | `plan_id`, `mission_id`, `plan_version`, `status`, `body_json`, `created_by`, `approved_by`, timestamps |
| `subtasks` | `subtask_id`, `plan_id`, `mission_id`, `status`, `risk`, `depends_on[]`, `body_json` |
| `assignments` | `assignment_id`, `mission_id`, `subtask_id`, `status`, `proposed_specialist`, `approved_by` |
| `missions` (extend) | add `status_before_block` nullable; allow coarse status values per ADR |

Existing: `intakes`, `missions`, `audit_events`, `notion_sync`, `policies`, `capabilities`.

---

## 8. API command proposal (design only)

All mutating routes are **commands**. Forbidden: `PATCH /missions/{id}/status`, `PATCH /plans/{id}/status`, etc.

| Method | Path (proposed) | Purpose |
|---|---|---|
| POST | `/missions/{id}/plans` | Create draft plan (next version) |
| POST | `/plans/{id}/submit` | draft → awaiting_approval |
| POST | `/plans/{id}/approve` | Operator approve |
| POST | `/plans/{id}/reject` | Operator reject + reason |
| POST | `/plans/{id}/subtasks/generate` | L0–L1 from approved plan |
| POST | `/missions/{id}/assignments/propose` | Propose assignment set |
| POST | `/assignments/{id}/approve` | Operator approve |
| POST | `/assignments/{id}/reject` | Operator reject |
| POST | `/missions/{id}/transitions` | Extend with block/unblock/cancel only for mission coarse states |

Headers: `Idempotency-Key`, `X-Correlation-Id` as today.

---

## 9. Security & authority matrix

| Action | Operator | ChatGPT / assistant | n8n | System |
|---|---|---|---|---|
| Draft plan | Yes | Yes (draft only) | No | May assist |
| Approve / reject plan | **Yes** | **No** | No | No |
| Generate L0–L1 subtasks | Yes | Suggest only | No | After approve |
| Propose assignment | Yes | Suggest only | No | Yes |
| Approve assignment | **Yes** (when required) | **No** | No | Auto only if future policy allows L0 — default 3a: human where required |
| Dispatch execution | No in 3a | No | Adapter later | No in 3a |
| Mutate via Notion | No | No | No | No |

Every transition: `actor`, `reason`, `correlation_id`, `policy_result`, audit append.

---

## 10. n8n boundary (later execution phase)

```text
AIPOS Core decides WHAT/WHEN (commands, gates, audit)
n8n executes HOW (connectors) under a job id issued by Core
n8n MUST NOT be Mission decision authority
n8n MUST NOT write Mission.status directly
Results return as adapter callbacks → Core commands update execution_job / later review
```

Phase 3a: **no n8n runtime**, no production workflows.

---

## 11. Compatibility with locked enums

| Enum | Rule |
|---|---|
| `mission.status=ready` | Continues to mean **ready_for_planning** |
| Intake `ready_to_dispatch` | Continues to mean **ready_to_map** |
| Rename either | **Forbidden** without dedicated ADR |

---

## Related

- [PHASE_3_ACCEPTANCE_CRITERIA.md](./PHASE_3_ACCEPTANCE_CRITERIA.md)  
- [PHASE_3_DELIVERY_PLAN.md](./PHASE_3_DELIVERY_PLAN.md)  
- [AIPOS_ARCHITECTURE_CONTRACT.md](./AIPOS_ARCHITECTURE_CONTRACT.md)  
