-- Phase 2 hardening — non-destructive
-- Enforces C-03 at the database: one mission per confirmed intake_id + intake_version.
-- Safe to re-run (IF NOT EXISTS). Does not DROP or rewrite data.

CREATE UNIQUE INDEX IF NOT EXISTS missions_source_intake_version_uidx
  ON missions (source_intake_id, source_intake_version);
