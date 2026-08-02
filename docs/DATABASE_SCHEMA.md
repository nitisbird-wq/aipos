# Database Schema (Proposed)

Runtime store: **PostgreSQL** (App DB = runtime SSOT).

Aligned with `docs/AIPOS_ARCHITECTURE_CONTRACT.md` and `packages/schemas/*.schema.json`.

## State machines (do not collapse)

| Machine | Field | Values (v1) | Semantic notes |
|---|---|---|---|
| Intake | `readiness_status` | `needs_input` \| `awaiting_confirmation` \| `ready_to_dispatch` \| `cancelled` | `ready_to_dispatch` = **ready_to_map** (not specialist dispatch). Confirmed via `confirmed_by_user`. |
| Mission | `status` | `ready` \| `blocked` \| `cancelled` (+ `draft`/`understanding` reserved) | `ready` = **ready_for_planning**. Rename requires ADR. |
| Planning | `planning_status` | MVP: `not_started` | Later values owned by Planning module |
| Sync | `notion_sync.sync_status` | `not_started` \| `pending` \| `synced` \| `mock_synced` \| `failed` \| `conflict` | Separate from mission status. `mock_synced` = dev-only. |

## Tables

### users
- id (uuid PK)
- email (unique)
- name
- created_at

### intakes
- id (text PK) — INT-...
- intake_version
- requester_id
- source
- source_message_ref
- raw_request (text)
- bundle_json (jsonb) — full IntakeMissionBundle
- readiness_status
- confirmed_by_user
- idempotency_key (unique)
- created_at, updated_at

### missions
- id (text PK) — MIS-...
- object_version
- revision (int)
- source_intake_id (FK intakes)
- source_intake_version
- mapping_version
- status
- planning_status
- planning_revision
- last_planned_at
- planning_reason
- criticality
- mission_json (jsonb) — Mission Object body
- created_at, updated_at

### notion_sync
App DB owns verification metadata and Notion page identity (C-01).

- mission_id (PK/FK)
- notion_page_id (nullable; set only after readback; reuse on retry)
- sync_status — `not_started` \| `pending` \| `synced` \| `mock_synced` \| `failed` \| `conflict`
- sync_attempt_id (nullable)
- verified_by (nullable) — `operator:<id>`; never chatgpt alone
- verified_at (nullable timestamptz)
- verification_method — `user_confirm_mapping` \| `manual_retry` \| `diagnostic_force`
- verification_version
- source_record_version — mission revision (+ intake version) at verify time
- policy_decision_id
- last_error
- synced_at
- updated_at

### audit_events
Append-only (M-03). Command transitions must record actor, reason, correlation, states, policy_result.

- id (uuid PK) — event_id
- aggregate_type (nullable) — intake \| mission \| notion_sync \| …
- mission_id (nullable)
- intake_id (nullable)
- actor
- action
- reason
- correlation_id
- causation_id (nullable)
- previous_state
- new_state
- policy_result (jsonb)
- created_at — occurred_at

### policies
- policy_id + version (composite PK)
- name, rule_key, description
- severity, enabled
- action_on_violation
- effective_from
- change_reason
- change_log (jsonb)

### capabilities
- capability_id (PK)
- family
- payload (jsonb) — specialists, flags, domain status
- enabled
- updated_at

## Indexes

- intakes(idempotency_key) unique
- missions(source_intake_id)
- missions(status, updated_at)
- audit_events(mission_id, created_at)
- audit_events(correlation_id)

## Field ownership (summary)

| Field | Owner |
|---|---|
| mission_id, mission status, verification_*, notion_page_id, sync_status | App DB |
| operational free-form registry notes | Notion-only (MVP) |
| architecture / JSON schemas / this doc | GitHub |

## Forbidden

- `PATCH /missions/{id}/status` — use transition commands + audit_events only.
