-- AIPOS Mission Intake MVP — PostgreSQL / Neon compatible schema
-- Domain contract aligned with docs/AIPOS_ARCHITECTURE_CONTRACT.md (C-01, M-03)
-- and packages/schemas/*.schema.json
--
-- State machines (do not collapse):
--   Intake readiness_status: needs_input | awaiting_confirmation | ready_to_dispatch (+ cancelled via flags/flow)
--   Mission status: ready (= ready_for_planning semantically) | blocked | cancelled (+ draft/understanding reserved)
--   Sync sync_status: not_started | pending | synced | mock_synced | failed | conflict
-- Enum rename of ready / ready_to_dispatch requires a separate ADR.

CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS intakes (
  id TEXT PRIMARY KEY,
  intake_version TEXT NOT NULL,
  requester_id TEXT NOT NULL,
  source TEXT NOT NULL,
  source_message_ref TEXT NOT NULL,
  raw_request TEXT NOT NULL,
  bundle_json JSONB NOT NULL,
  readiness_status TEXT NOT NULL,
  confirmed_by_user BOOLEAN NOT NULL DEFAULT false,
  idempotency_key TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS intakes_idempotency_key_idx ON intakes (idempotency_key);

CREATE TABLE IF NOT EXISTS missions (
  id TEXT PRIMARY KEY,
  object_version TEXT NOT NULL,
  revision INTEGER NOT NULL,
  source_intake_id TEXT NOT NULL REFERENCES intakes(id),
  source_intake_version TEXT NOT NULL,
  mapping_version TEXT NOT NULL,
  status TEXT NOT NULL,
  planning_status TEXT NOT NULL,
  planning_revision INTEGER NOT NULL,
  last_planned_at TIMESTAMPTZ,
  planning_reason TEXT,
  criticality TEXT NOT NULL,
  mission_json JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS missions_source_intake_id_idx ON missions (source_intake_id);
CREATE INDEX IF NOT EXISTS missions_status_updated_at_idx ON missions (status, updated_at);
-- C-03: one mission per confirmed intake_id + intake_version (also applied via 0001_*.sql)
CREATE UNIQUE INDEX IF NOT EXISTS missions_source_intake_version_uidx
  ON missions (source_intake_id, source_intake_version);

-- Notion projection / sync (separate state machine; App DB owns verification + page id)
CREATE TABLE IF NOT EXISTS notion_sync (
  mission_id TEXT PRIMARY KEY REFERENCES missions(id),
  notion_page_id TEXT,
  sync_status TEXT NOT NULL,
  sync_attempt_id TEXT,
  verified_by TEXT,
  verified_at TIMESTAMPTZ,
  verification_method TEXT,
  verification_version TEXT,
  source_record_version TEXT,
  policy_decision_id TEXT,
  last_error TEXT,
  synced_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE IF NOT EXISTS audit_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  aggregate_type TEXT,
  mission_id TEXT,
  intake_id TEXT,
  actor TEXT NOT NULL,
  action TEXT NOT NULL,
  reason TEXT NOT NULL,
  correlation_id TEXT NOT NULL,
  causation_id TEXT,
  previous_state TEXT,
  new_state TEXT,
  policy_result JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS audit_events_mission_created_idx ON audit_events (mission_id, created_at);
CREATE INDEX IF NOT EXISTS audit_events_correlation_idx ON audit_events (correlation_id);

CREATE TABLE IF NOT EXISTS policies (
  policy_id TEXT NOT NULL,
  version TEXT NOT NULL,
  name TEXT NOT NULL,
  rule_key TEXT NOT NULL,
  description TEXT NOT NULL,
  severity TEXT NOT NULL,
  enabled BOOLEAN NOT NULL,
  action_on_violation TEXT NOT NULL,
  effective_from TEXT NOT NULL,
  change_reason TEXT NOT NULL,
  change_log JSONB NOT NULL,
  PRIMARY KEY (policy_id, version)
);

CREATE TABLE IF NOT EXISTS capabilities (
  capability_id TEXT PRIMARY KEY,
  family TEXT NOT NULL,
  payload JSONB NOT NULL,
  enabled BOOLEAN NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL
);
