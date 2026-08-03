import {
  pgTable,
  text,
  boolean,
  timestamp,
  jsonb,
  integer,
  uuid,
  primaryKey,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";

/**
 * PostgreSQL-compatible schema (Neon-ready).
 * Runtime system of record — not Notion.
 * Must stay aligned with apps/web/drizzle/0000_init.sql (Commit 2 domain contract).
 */
export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: text("email").notNull().unique(),
  name: text("name").notNull(),
  created_at: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const intakes = pgTable(
  "intakes",
  {
    id: text("id").primaryKey(),
    intake_version: text("intake_version").notNull(),
    requester_id: text("requester_id").notNull(),
    source: text("source").notNull(),
    source_message_ref: text("source_message_ref").notNull(),
    raw_request: text("raw_request").notNull(),
    bundle_json: jsonb("bundle_json").notNull(),
    readiness_status: text("readiness_status").notNull(),
    confirmed_by_user: boolean("confirmed_by_user").notNull().default(false),
    idempotency_key: text("idempotency_key").notNull().unique(),
    created_at: timestamp("created_at", { withTimezone: true }).notNull(),
    updated_at: timestamp("updated_at", { withTimezone: true }).notNull(),
  },
  (t) => [index("intakes_idempotency_key_idx").on(t.idempotency_key)],
);

export const missions = pgTable(
  "missions",
  {
    id: text("id").primaryKey(),
    object_version: text("object_version").notNull(),
    revision: integer("revision").notNull(),
    source_intake_id: text("source_intake_id")
      .notNull()
      .references(() => intakes.id),
    source_intake_version: text("source_intake_version").notNull(),
    mapping_version: text("mapping_version").notNull(),
    status: text("status").notNull(),
    planning_status: text("planning_status").notNull(),
    planning_revision: integer("planning_revision").notNull(),
    last_planned_at: timestamp("last_planned_at", { withTimezone: true }),
    planning_reason: text("planning_reason"),
    criticality: text("criticality").notNull(),
    mission_json: jsonb("mission_json").notNull(),
    created_at: timestamp("created_at", { withTimezone: true }).notNull(),
    updated_at: timestamp("updated_at", { withTimezone: true }).notNull(),
  },
  (t) => [
    index("missions_source_intake_id_idx").on(t.source_intake_id),
    index("missions_status_updated_at_idx").on(t.status, t.updated_at),
    uniqueIndex("missions_source_intake_version_uidx").on(
      t.source_intake_id,
      t.source_intake_version,
    ),
  ],
);

export const notionSync = pgTable("notion_sync", {
  mission_id: text("mission_id")
    .primaryKey()
    .references(() => missions.id),
  notion_page_id: text("notion_page_id"),
  sync_status: text("sync_status").notNull(),
  sync_attempt_id: text("sync_attempt_id"),
  verified_by: text("verified_by"),
  verified_at: timestamp("verified_at", { withTimezone: true }),
  verification_method: text("verification_method"),
  verification_version: text("verification_version"),
  source_record_version: text("source_record_version"),
  policy_decision_id: text("policy_decision_id"),
  last_error: text("last_error"),
  synced_at: timestamp("synced_at", { withTimezone: true }),
  updated_at: timestamp("updated_at", { withTimezone: true }).notNull(),
});

export const auditEvents = pgTable(
  "audit_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    aggregate_type: text("aggregate_type"),
    mission_id: text("mission_id"),
    intake_id: text("intake_id"),
    actor: text("actor").notNull(),
    action: text("action").notNull(),
    reason: text("reason").notNull(),
    correlation_id: text("correlation_id").notNull(),
    causation_id: text("causation_id"),
    previous_state: text("previous_state"),
    new_state: text("new_state"),
    policy_result: jsonb("policy_result").notNull(),
    created_at: timestamp("created_at", { withTimezone: true }).notNull(),
  },
  (t) => [
    index("audit_events_mission_created_idx").on(t.mission_id, t.created_at),
    index("audit_events_correlation_idx").on(t.correlation_id),
  ],
);

export const policies = pgTable(
  "policies",
  {
    policy_id: text("policy_id").notNull(),
    version: text("version").notNull(),
    name: text("name").notNull(),
    rule_key: text("rule_key").notNull(),
    description: text("description").notNull(),
    severity: text("severity").notNull(),
    enabled: boolean("enabled").notNull(),
    action_on_violation: text("action_on_violation").notNull(),
    effective_from: text("effective_from").notNull(),
    change_reason: text("change_reason").notNull(),
    change_log: jsonb("change_log").notNull(),
  },
  (t) => [primaryKey({ columns: [t.policy_id, t.version] })],
);

export const capabilities = pgTable("capabilities", {
  capability_id: text("capability_id").primaryKey(),
  family: text("family").notNull(),
  payload: jsonb("payload").notNull(),
  enabled: boolean("enabled").notNull(),
  updated_at: timestamp("updated_at", { withTimezone: true }).notNull(),
});
