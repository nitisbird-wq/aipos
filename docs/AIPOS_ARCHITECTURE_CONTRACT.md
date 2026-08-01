# AIPOS Architecture Contract — Intake MVP (Enforceable)

**Status:** Approved with Conditions — conditions closed in this document (2026-08-02)  
**Parent:** [AIPOS_ARCHITECTURE.md](./AIPOS_ARCHITECTURE.md), [AIPOS_PHASE_1_DECISIONS.md](./AIPOS_PHASE_1_DECISIONS.md)  
**Audience:** Cursor agents, human reviewers, tests/CI  
**Scope:** Mission Intake MVP = Intake → Mapping → Notion projection only (no planning/subtasks/matching/assignment/execution)

Agents SHALL treat this file as an enforceable design contract. Deviations require a new ADR.

---

## 0. Locked SoT boundaries

| Store | SSOT for |
|---|---|
| App Database | Runtime transactions: intakes, missions, audit, sync status, jobs |
| Notion | Ops/knowledge: Mission Registry projection, Identity/Role knowledge |
| GitHub / this repo | Code, schemas, architecture/ADR docs, CI, releases |

Notion is **not** the runtime store for every internal event.

---

## 1. C-01 — Verified write contract (Notion projection)

“Verified write only” means **G5 external verification**, not ChatGPT self-assertion.

### Required fields on Notion sync record (App DB)

| Field | Meaning |
|---|---|
| `verified_by` | Actor who authorized the projection attempt (`operator:<id>` after user confirm; never `chatgpt` alone) |
| `verified_at` | ISO timestamp of authorization / mapping accept |
| `verification_method` | `user_confirm_mapping` \| `manual_retry` \| `diagnostic_force` |
| `verification_version` | Policy/schema version string used at verify time |
| `source_record_version` | Mission `revision` (and intake version) at verify time |
| `policy_decision_id` | Mapping/Handling gate result id or policy refs joined |
| `notion_page_id` | Present only after successful readback |
| `sync_status` | `pending` \| `synced` \| `mock_synced` \| `failed` |

### Who may authorize Notion projection

| Actor | May authorize? |
|---|---|
| User (mission owner) | Yes — via confirm intake / explicit retry |
| ChatGPT | No — may recommend only |
| AIPOS Core policy | May **block**; may auto-enqueue sync **only after** user confirm (not a substitute for user confirm) |
| Admin / Commander (human) | Yes, same as user for single-operator MVP |

### SHALL NOT sync unless all hold

```text
intake.confirmed_by_user = true
bundle.readiness_status = ready_to_dispatch   # semantic: ready_to_map (see §3)
mission.status = ready                        # semantic: ready_for_planning (see §3)
verified_by present
verified_at present
Handling + Mapping gates passed
source_record_version matches current mission.revision
```

If mission/intake content changes after verify → **invalidate** prior verification; set `sync_status=pending` or require re-confirm before external write. Never claim `synced` without readback `notion_page_id`.

`mock_synced` is development-only and MUST NOT be presented as Notion verified.

---

## 2. C-02 — Field ownership matrix

| Field | Owner | Editable in Notion | Sync direction |
|---|---|---|---|
| `mission_id` | App DB | No | App → Notion |
| `source_intake_id` | App DB | No | App → Notion |
| `status` (mission) | App DB | No | App → Notion |
| `planning_status` | App DB | No | App → Notion |
| `title` / `mission_summary` | App DB | No (MVP) | App → Notion |
| `desired_outcome` / `success_criteria` | App DB | No (MVP) | App → Notion |
| `operational_risk` / `sensitivity_flags` | App DB | No | App → Notion |
| `notion_page_id` | App DB | No | Internal + optional display |
| `sync_status` / `last_error` / `synced_at` | App DB | No | Internal only |
| Operator free-form registry notes (if any) | Notion | Yes | Notion-only in MVP (not overwritten by app) |
| Knowledge tags beyond allow-list | Notion | Yes | Notion-only until Phase later |

**Conflict rule (MVP):** App DB wins for all owned fields. Notion edits to owned fields are ignored by the app until a future bidirectional policy ADR.

---

## 3. H-01 / H-02 — State machines (semantic lock)

### 3.1 Bundle readiness vs Mission status (vocabulary)

| Term in schemas today | Enforceable meaning in MVP |
|---|---|
| `ready_to_dispatch` (bundle) | **Ready to map** to a Mission Object — NOT specialist dispatch |
| `ready` (mission.status) | **Ready for planning** — mapped + confirmed; planning/execution out of MVP |
| `planning_status=not_started` | Planning module has not run (expected in MVP) |

Do not interpret MVP `ready` as ready for execution/dispatch. Future rename to `ready_for_planning` requires schema ADR; until then code/docs MUST use the semantic above.

### 3.2 Logical state machines (do not collapse into one field)

**Intake / Bundle (`readiness_status` + confirmation flags)**

```text
needs_input → awaiting_confirmation → ready_to_dispatch(ready_to_map)
cancelled (terminal for intake)
```

Chat conversation states may live in `knowledge_refs` but MUST map to readiness without replacing the bundle schema.

**Mission (`status`)**

```text
ready          # ready_for_planning
blocked
cancelled
```

MVP MAY retain schema enum values `draft` / `understanding` for forward compatibility but SHOULD NOT use `understanding` as a post-mapping mission lifecycle state in new code paths.

**Sync (`sync_status` on notion_sync — separate from mission.status)**

```text
pending → synced | mock_synced | failed
```

Future: `conflict` when source_version diverges after sync (document when implementing).

---

## 4. C-03 — Idempotency contract

Required identifiers:

| Id | Role |
|---|---|
| `intake_id` | Aggregate id |
| `intake_version` / bundle version | Immutability checkpoint after confirm |
| `idempotency_key` | Client/create dedupe |
| `mission_id` | Mapping product |
| `correlation_id` | Trace across commands |
| `sync_attempt_id` | Per Notion attempt |
| `notion_page_id` | Stable external identity after first success |

### Rules

```text
Mapping the same confirmed intake_id + intake_version SHALL return the same mission_id.

Notion sync for the same mission_id + source_record_version SHALL update the existing
notion_page_id when present — SHALL NOT create a second page.

Confirm/create with the same Idempotency-Key SHALL not create duplicate intakes.
```

All mutating commands SHOULD accept `Idempotency-Key` and/or be naturally idempotent by aggregate key.

---

## 5. H-05 — Notion failure / projection behavior

MVP SHALL use **asynchronous projection semantics** (even if implemented in-process):

```text
Mission created in App DB (status=ready)
→ sync_status=pending
→ attempt Notion write
→ readback
→ synced | mock_synced | failed
```

| Case | Behavior |
|---|---|
| Notion down / write fails | Mission **remains** in App DB; `sync_status=failed`; UI shows failure |
| Retry | `POST /missions/{id}/notion/retry` when `failed` (existing rules) |
| Success | Persist `notion_page_id`; only then claim external_verified |
| Duplicate prevention | Reuse `notion_page_id` on retry/update |

Notion failure MUST NOT roll back Mission creation after Mapping accept.

Required sync fields: `retry` visibility, `last_error`, `synced_at`, `source_record_version`, audit on attempts.

---

## 6. H-04 — ChatGPT authority boundary

Display name preference: **Mission Commander Assistant** (not autonomous Commander).

```text
ChatGPT MAY:
- analyze, recommend, draft, identify risks, propose work maps

ChatGPT SHALL NOT:
- confirm a mission on behalf of the user
- change locked decisions / ADRs
- approve sensitive external transfers
- dispatch execution / invoke specialists in MVP
- modify production state without explicit user authorization + Core gates
```

User remains final authority. AIPOS Core enforces gates.

---

## 7. H-03 — Data destination lifecycle (minimum schema)

Each destination entry SHOULD include (extend MVP JSON over time):

```json
{
  "system": "intake_channel",
  "trust_class": "approved_private",
  "data_classification": "confidential",
  "purpose": "mission_intake",
  "persistence": "conversation_only",
  "retention_days": 30,
  "external_transfer": false,
  "redaction_required": true,
  "owner": "mission_owner",
  "lawful_purpose": "mission_intake",
  "encryption_requirement": "transit_tls",
  "allowed_processors": ["aipos_core"],
  "redaction_policy": "need_to_know"
}
```

Notion registry destination is a **separate** entry (`system=notion`, `purpose=mission_registry`) — never hidden inside `chat_only`.

Case/police sensitive data: Need-to-Know; pilot SHALL NOT use real case credentials/health/minors data.

---

## 8. M-01 — Thin control plane allow/deny list (MVP)

### Core MAY

```text
create/analyze/correct/confirm/cancel intake
map confirmed bundle → mission
command-based mission transitions (block/cancel as allowed)
enqueue/retry Notion projection
write append-oriented audit events
read policies/capabilities seeds
```

### Core SHALL NOT (MVP)

```text
task decomposition / subtask creation
agent matching / assignment
execution dispatch / specialist invocation
autonomous scheduling
multi-agent planning
```

---

## 9. M-02 — Extensibility acceptance

- Intake UI uses documented API contract only  
- Mission Object is not bound 1:1 to Notion property schema  
- Frontend does not call n8n directly  
- Planning module can be added without replacing intake conversation model  
- Mission detail may grow extension sections  
- Breaking API changes require version note in `API_CONTRACT.md`

---

## 10. M-03 — Audit model

Audit events are **append-only** in normal operation (no update/delete of historical events).

Minimum fields: `event_id`, `aggregate_type`, `aggregate_id`, `command`/`action`, `actor`, `previous_state`, `new_state`, `correlation_id`, `policy_result`, `occurred_at` (`created_at`).  
Prefer `causation_id` and payload hash/snapshot ref when available.

---

## 11. Canonical MVP flow (Outbox / Projection)

```text
Browser
  → Intake API
  → Intake aggregate (needs_input | awaiting_confirmation | ready_to_map | cancelled)
  → User confirm
  → Mapping Service (idempotent)
  → Mission aggregate (ready_for_planning; planning_status=not_started)
  → Outbox / sync job (pending)
  → Notion Projection Worker
  → Notion Registry (synced | failed)
```

---

## 12. Forbidden APIs

```text
PATCH /missions/{id}/status
```

Use command transitions only (`POST /missions/{id}/transitions`, etc.).

---

## Change log

| Date | Note |
|---|---|
| 2026-08-02 | Closed Approve-with-Conditions gaps C-01…C-03, H-01…H-05 (+ M allow-list) as enforceable contract |
