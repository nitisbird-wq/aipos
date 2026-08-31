# ADR-005 — Planning, Subtask, and Assignment (Phase 3a)

- **Status:** Proposed (awaiting Human approval)  
- **Date:** 2026-08-03  
- **Deciders:** Mission owner (Human) — Pre-Phase-3 Verification conditional approval  
- **Supersedes:** none  
- **Related:** AIPOS-ADR-004 / Phase 1 Decisions (D2, D6); Architecture Contract (status vocabulary); [PHASE_3_SCOPE.md](../docs/PHASE_3_SCOPE.md); [ADR-007 — Capability Orchestration](./ADR-007-AIPOS-CAPABILITY-ORCHESTRATION.md) (Reserved; routing gated)

---

## Context

Mission Intake MVP ends at Mission `status=ready` (**ready_for_planning**). Phase 2 establishes PostgreSQL as runtime SSOT. Phase 3 must introduce Planning → Subtasks → Assignment without collapsing state machines, without Notion-as-runtime-DB, and without jumping to n8n Execution.

Pre-Phase-3 Verification confirmed Artifact / Review / Closeout are **NOT STARTED** in code; Monitoring is **PARTIAL/THIN**. Notion integration is already App DB → Notion only.

---

## Decision

### D-005.1 — Phase 3a boundary

Phase 3a ends at **Assignment approved / `assignment.status=approved`**.  
Out of scope for 3a: Execution, n8n runtime, Artifact, Review, Closeout, production monitoring.

### D-005.2 — Separate state machines

Detailed lifecycle is owned by child aggregates:

- `plan.status`
- `subtask.status`
- `assignment.status`
- (later) `execution_job.status`, `artifact.status`, `review.status`

**Mission.status remains coarse-grained** and MUST NOT mirror every child state.

### D-005.3 — Proposed Mission.status (coarse)

| Value | Meaning |
|---|---|
| `ready` | **ready_for_planning** (semantic lock; do not rename without ADR) |
| `active` | Planning/assignment work in progress or completed through assignment |
| `blocked` | Paused; restore via `status_before_block` |
| `cancelled` | Terminal cancel |
| `closed` | Terminal successful closeout (reserved; not used in 3a) |

Intake `ready_to_dispatch` remains **ready_to_map**. Do not rename.

Legacy schema values `draft` / `understanding` may remain for compatibility but MUST NOT be used as post-mapping lifecycle in new 3a paths.

### D-005.4 — Command-only transitions

- No direct status PATCH on Mission / Plan / Subtask / Assignment  
- Every transition records: actor, reason, correlation_id, previous_state, new_state, policy_result, audit append  
- ChatGPT may draft; **must not** approve  
- User is final authority  
- n8n is execution adapter only (later phase); never Mission decision authority  

### D-005.5 — Notion one-way

```text
App DB / PostgreSQL → Notion   ALLOWED (projection + write readback metadata)
Notion → runtime state         FORBIDDEN
```

No webhook / poll / import from Notion into Mission/Plan/Subtask/Assignment/Execution.  
Future operator profile pull = separate aggregate + separate ADR.

### D-005.6 — Open question resolutions (approved)

| # | Decision |
|---|---|
| 1 | `execution_failed` (future): default re-enter assignment; return toward planned only when failure cause is planning defect requiring human decision |
| 2 | `plan_rejected`: Mission remains in planning (`active`); rejected plan → `rejected`/`superseded`; create **new plan version**; do **not** return Mission to `ready` by default |
| 3 | `blocked`: store `status_before_block`; unblock restores previous valid state; do not always return to `ready` |
| 4 | Phase 3a ends at assignment approved; Execution needs separate ADR |
| 5 | MissionStatus stays coarse; detailed lifecycle in child status fields |

### D-005.7 — Plan versioning

Unique logical key `(mission_id, plan_version)`. Reject → new version; history retained. Idempotent creates via Idempotency-Key.

### D-005.8 — App DB ownership

Plans, Subtasks, Assignments are runtime transactions in PostgreSQL (same SoT class as Missions/Audit). Notion is not the planning SSOT.

---

## Consequences

### Positive

- Clear 3a deliverable without Execution entanglement  
- Preserves Architecture Contract vocabulary  
- Enables additive schema/migrations  
- Aligns docs/dashboards with repository reality  

### Negative / follow-up

- Coarse Mission.status requires UI to read child aggregates for detail  
- D2 “auto-run L0–L1 execute” deferred; must be reconciled in Execution ADR  
- Schema enum expansion for Mission.status needs a coordinated migration PR after this ADR is Approved  

### Forbidden without new ADR

- Renaming `ready` / `ready_to_dispatch`  
- Notion→runtime bidirectional sync  
- Collapsing plan/subtask/assignment into a single Mission.status field  
- Shipping Execution/n8n under Phase 3a  

---

## Compliance checklist (for implementers)

- [ ] No source code in the docs PR that carries this ADR  
- [ ] Implementation PRs cite ADR-005  
- [ ] Tests for reject→new version, status_before_block, actor auth  
- [ ] CURRENT_CAPABILITIES remains authoritative for traffic lights  

---

## References

- [PHASE_3_ARCHITECTURE.md](../docs/PHASE_3_ARCHITECTURE.md) — matrices & diagrams  
- [PHASE_3_ACCEPTANCE_CRITERIA.md](../docs/PHASE_3_ACCEPTANCE_CRITERIA.md)  
- [PHASE_3_DELIVERY_PLAN.md](../docs/PHASE_3_DELIVERY_PLAN.md)  
- [AIPOS_ARCHITECTURE_CONTRACT.md](../docs/AIPOS_ARCHITECTURE_CONTRACT.md)  
- [AIPOS_PHASE_1_DECISIONS.md](../docs/AIPOS_PHASE_1_DECISIONS.md)  
