# AIPOS Phase 3 Scope — Planning & Assignment (3a)

**Status:** Approved for documentation (Pre-Phase-3 Verification, conditional approval)  
**Depends on:** Phase 2 Runtime Foundation (PostgreSQL App DB) — [PR #8](https://github.com/nitisbird-wq/aipos/pull/8) — **COMPLETE / PRODUCTION PASS**  
**Operational SoT:** [AIPOS CURRENT STATE](https://app.notion.com/p/3cdbc165be4c81c48e73e5899ae5f0e3)  
**Binding ADR:** [ADR-005](../adr/ADR-005-PLANNING-SUBTASK-ASSIGNMENT.md)  
**Capability Orchestration:** [ADR-007](../adr/ADR-007-AIPOS-CAPABILITY-ORCHESTRATION.md) (Reserved — separate from ADR-006 Control Tower)  
**Does not modify:** `docs/AIPOS_ARCHITECTURE_CONTRACT.md` without a further ADR

---

## Capability status correction (must match repository + operational truth)

| Capability | Status | Notes |
|---|---|---|
| Mission Intake → Confirm → Mission `ready` | **DONE / PRODUCTION PASS** | Intake MVP + n8n Mission Intake Pilot |
| PostgreSQL runtime adapter | **Phase 2 COMPLETE** (local opt-in via `FORCE_POSTGRES`) | Production Phase 2 PASS; see Notion CURRENT STATE |
| Planning Engine | **NOT STARTED** | Schema has `planning_*` only |
| Subtask creation (L0–L1) | **NOT STARTED** | Forbidden in Intake MVP |
| Assignment (propose + approve) | **NOT STARTED** | Seeds only; no auto-route |
| Capability Orchestration / Decompose + Route | **PROTOTYPE ONLY** | n8n `AIPOS — P3 Decompose + Route v0.1` unpublished; ADR-007 Reserved |
| Execution (n8n beyond intake) | **NOT STARTED** for Phase 3a | Frozen intake workflow must not be modified by agents |
| Artifact | **NOT STARTED** as Phase 3a OS loop | Continuity stage artifacts are separate |
| Review (post-execution) | **NOT STARTED** | Do not confuse with Intake Confirm |
| Closeout | **NOT STARTED** | Future (D5) |
| Monitoring | **PARTIAL / THIN** | Mission list + audit + sync badge only |

Any dashboard or roadmap that marks Artifact / Review / Closeout as complete is **incorrect** and must be corrected to the table above. Phase 3 routing remains blocked until Mission Decomposer is approved.

---

## Phase 3a — In scope

Starting from: **Mission with `status=ready`** (`ready` = **ready_for_planning**; do not rename).

```text
Mission ready
  → Create Draft Plan (versioned)
  → Human Approves Plan Once (or rejects → new plan version; Mission stays in planning)
  → Generate L0–L1 Subtasks
  → Validate Dependencies
  → Propose Assignment
  → Human Approval where required
  → End state: Assignment approved / Mission coarse status active+assigned (see ADR-005)
```

### Included capabilities

1. Plan aggregate ownership + versioning in App DB  
2. Plan state machine + reject → new version (Mission remains in planning)  
3. L0–L1 Subtask generation from approved plan (no deep L2+ decomposition)  
4. Dependency validation among proposed subtasks  
5. Assignment proposal + human approval gates  
6. Command-only transitions with full audit  
7. Coarse Mission.status updates only (`ready` / `active` / `blocked` / `cancelled` / `closed` — see ADR)  
8. Docs + schemas + tests for the above (implementation in later PRs; this branch is docs-only)

### Explicitly out of scope (Phase 3a)

| Item | Reason |
|---|---|
| Execution / n8n runtime | Separate ADR / later phase |
| Specialist autonomous execution | Out |
| Artifact service | NOT STARTED; post-execution |
| Review (result approve/reject) | NOT STARTED; post-execution |
| Closeout / feedback / `learned_prefs` | NOT STARTED |
| Production monitoring / alerts / SLO | Beyond thin dashboard |
| Autonomous high-risk planning | Out |
| Deep L2+ task decomposition | Out |
| Production deploy / real sensitive data | Out |
| Automatic mission closeout | Out |
| Renaming `ready` / `ready_to_dispatch` | Requires separate ADR; forbidden here |

---

## Authority & SoT (locked)

| Store | Role |
|---|---|
| **PostgreSQL / App DB** | Runtime SSOT for Mission, Plan, Subtask, Assignment (and later Execution jobs) |
| **Notion** | Ops / knowledge / dashboard **projection only** (App DB → Notion) |
| **AIPOS Core** | Decision authority (gates, commands, idempotency) |
| **n8n** | Execution adapter **later** — not authority; not in 3a |
| **User** | Final authority for plan approve and assignment approve |
| **ChatGPT** | May draft plans/assignments; **must not** approve |

### Notion direction (Decision 2 — APPROVED)

```text
PostgreSQL / App DB  →  Notion   (allowed: projection + write readback metadata)
Notion               →  runtime Mission/Plan/Subtask/Assignment/Execution   (FORBIDDEN)
```

- No polling / webhook / import from Notion into runtime state  
- Readback after write: `notion_page_id` / sync result metadata only  
- Future Know-Me profile pull = **separate aggregate + separate ADR**

---

## Stop conditions

Stop and ask before:

- Expanding into Execution / Artifact / Review / Closeout  
- Changing Architecture Contract status vocabulary without ADR  
- Adding Notion→App runtime sync  
- Implementing application code on this docs branch  

---

## Related docs

- [PHASE_3_ARCHITECTURE.md](./PHASE_3_ARCHITECTURE.md)  
- [PHASE_3_ACCEPTANCE_CRITERIA.md](./PHASE_3_ACCEPTANCE_CRITERIA.md)  
- [PHASE_3_DELIVERY_PLAN.md](./PHASE_3_DELIVERY_PLAN.md)  
- [ADR-005](../adr/ADR-005-PLANNING-SUBTASK-ASSIGNMENT.md)  
- [CURRENT_CAPABILITIES.md](./CURRENT_CAPABILITIES.md)  
- [AIPOS_PHASE_1_DECISIONS.md](./AIPOS_PHASE_1_DECISIONS.md) (D2 confirm-once; D6 order)  
