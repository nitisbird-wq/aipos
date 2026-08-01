# AIPOS Architecture — Intake MVP Constraints

**Enforceable contract:** [AIPOS_ARCHITECTURE_CONTRACT.md](./AIPOS_ARCHITECTURE_CONTRACT.md)  
(verification, field ownership, idempotency, state semantics, Notion failure, ChatGPT authority)

## Approved roles

| Actor | Role |
|---|---|
| User | Mission owner and final authority |
| ChatGPT | Mission Commander **Assistant** / Intake / Strategic Reviewer (Phase 0.2+) — no confirm/dispatch authority |
| Notion | Mission Registry, Decision Log, Knowledge Base (ops/knowledge SSOT) |
| AIPOS Core | Custom orchestration control plane (thin in MVP: intake→mission) |
| n8n | Integration adapter / temporary bootstrap (not MVP execution) |
| Specialists | Execution systems (out of MVP) |
| Cursor | Development environment for building AIPOS |
| GitHub | Code, schemas, architecture/ADR docs, CI, release SSOT |

## MVP runtime vs registry

```text
Browser (responsive)
        │
Next.js App (API + UI)  ← AIPOS Core control plane
        │
┌───────┴────────┐
│  App Database  │  ← runtime SSOT (intakes, missions, audit, sync)
└───────┬────────┘
        │ verified write only (see Architecture Contract §1)
┌───────▼────────┐
│ Notion Registry│  ← ops/knowledge SSOT / Digital Brain projection
└────────────────┘

GitHub ← code + architecture SSOT (not mission runtime)
```

Notion is **not** the runtime store for every internal event.  
Mission creation MUST succeed even if Notion sync fails (`sync_status=failed`).  
See `docs/AIPOS_PHASE_1_DECISIONS.md` and `docs/AIPOS_ARCHITECTURE_CONTRACT.md`.

## Intake vs Orchestration

- **Intake:** capture → understand → draft work map → risk/sensitivity → confirm → bundle ready_to_dispatch
- **Mapping:** Bundle → Mission Object (`status=ready` **means ready_for_planning**, `planning_status=not_started`, `subtask_ids=[]`)
- **Orchestration (later):** planning, subtasks, matching, assignment, execution

MVP implements Intake + Mapping + Notion **projection** only.  
Bundle `ready_to_dispatch` means **ready_to_map**, not specialist dispatch.

## MVP Intake channel

Phase v0.1 uses `source: "web_app"` with data destination:

```json
{
  "system": "intake_channel",
  "trust_class": "approved_private",
  "purpose": "chat_only",
  "persistence": "conversation_only",
  "external_transfer": false
}
```

When Notion sync runs, add a separate destination entry for `notion` (not hidden inside chat_only).

## State rules

- No `PATCH /missions/{id}/status`
- Transitions via commands with actor, timestamp, reason, correlation_id, previous/new state, policy result
- MVP Mission states used: `draft` (optional pre-sync holding — prefer create only at `ready`), `ready`, `understanding`, `blocked`, `cancelled`
- Later orchestrator states may be defined in schema but unimplemented

## Extensibility

Intake frontend must remain usable when full AIPOS Core planning/execution is added later without replacing the Mission Intake UI.
