# Database Schema (Proposed)

Runtime store: **PostgreSQL**.

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
- mission_id (PK/FK)
- notion_page_id (nullable)
- sync_status — pending|synced|failed
- last_error
- synced_at
- updated_at

### audit_events
- id (uuid PK)
- mission_id (nullable)
- intake_id (nullable)
- actor
- action
- reason
- correlation_id
- previous_state
- new_state
- policy_result (jsonb)
- created_at

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
- audit_events(mission_id, created_at)
- missions(status, updated_at)
