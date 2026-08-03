import { and, desc, eq } from "drizzle-orm";
import { promises as fs } from "fs";
import path from "path";
import type { IntakeMissionBundle } from "@/lib/schemas/intake";
import type { MissionObject, NotionSyncRecord } from "@/lib/schemas/mission";
import type { AuditEvent, Capability, Policy } from "@/lib/schemas/policy";
import { getDb, type AiposDb } from "@/lib/db/client";
import {
  auditEvents,
  capabilities,
  intakes,
  missions,
  notionSync,
  policies,
} from "@/lib/db/schema";
import type { Repository } from "./types";

function toDate(iso: string | null | undefined): Date | null {
  if (!iso) return null;
  return new Date(iso);
}

function toIso(value: Date | string | null | undefined): string | null {
  if (value == null) return null;
  if (typeof value === "string") return value;
  return value.toISOString();
}

function requireIso(value: Date | string | null | undefined, fallback?: string): string {
  const iso = toIso(value);
  if (iso) return iso;
  if (fallback) return fallback;
  return new Date().toISOString();
}

type CapabilityPayload = Omit<Capability, "capability_id" | "family" | "enabled">;

function capabilityToRow(cap: Capability) {
  const { capability_id, family, enabled, ...rest } = cap;
  return {
    capability_id,
    family,
    enabled,
    payload: rest as CapabilityPayload,
    updated_at: new Date(),
  };
}

function rowToCapability(row: {
  capability_id: string;
  family: string;
  enabled: boolean;
  payload: unknown;
}): Capability {
  const payload = (row.payload ?? {}) as CapabilityPayload;
  return {
    capability_id: row.capability_id,
    family: row.family,
    enabled: row.enabled,
    ...payload,
  } as Capability;
}

function rowToNotionSync(row: typeof notionSync.$inferSelect): NotionSyncRecord {
  return {
    mission_id: row.mission_id,
    notion_page_id: row.notion_page_id,
    sync_status: row.sync_status as NotionSyncRecord["sync_status"],
    sync_attempt_id: row.sync_attempt_id,
    verified_by: row.verified_by,
    verified_at: toIso(row.verified_at),
    verification_method: row.verification_method as NotionSyncRecord["verification_method"],
    verification_version: row.verification_version,
    source_record_version: row.source_record_version,
    policy_decision_id: row.policy_decision_id,
    last_error: row.last_error,
    synced_at: toIso(row.synced_at),
    updated_at: requireIso(row.updated_at),
  };
}

function rowToAudit(row: typeof auditEvents.$inferSelect): AuditEvent {
  return {
    id: row.id,
    aggregate_type: row.aggregate_type as AuditEvent["aggregate_type"],
    mission_id: row.mission_id,
    intake_id: row.intake_id,
    actor: row.actor,
    action: row.action,
    reason: row.reason,
    correlation_id: row.correlation_id,
    causation_id: row.causation_id,
    previous_state: row.previous_state,
    new_state: row.new_state,
    policy_result: row.policy_result as AuditEvent["policy_result"],
    created_at: requireIso(row.created_at),
  };
}

async function loadSeedJson<T>(name: string): Promise<T> {
  const candidates = [
    path.resolve(process.cwd(), "../../data/seeds", name),
    path.resolve(process.cwd(), "data/seeds", name),
    path.resolve(process.cwd(), "../data/seeds", name),
    path.resolve(process.cwd(), "../../../data/seeds", name),
  ];
  for (const p of candidates) {
    try {
      const raw = await fs.readFile(p, "utf8");
      return JSON.parse(raw) as T;
    } catch {
      /* try next */
    }
  }
  return [] as T;
}

/**
 * PostgreSQL runtime adapter (App DB = runtime SSOT).
 * Stores full domain documents in JSONB (`bundle_json` / `mission_json`) and
 * denormalizes query/index columns per docs/DATABASE_SCHEMA.md + drizzle/0000_init.sql.
 * Verification metadata lives on `notion_sync` (C-01) — not a separate table.
 */
export class PostgresRepository implements Repository {
  readonly adapterName = "postgres" as const;
  private readonly db: AiposDb;
  private ready: Promise<void>;

  constructor(db?: AiposDb) {
    this.db = db ?? getDb();
    this.ready = this.ensureSeeded();
  }

  private async ensureSeeded(): Promise<void> {
    const existingPolicies = await this.db.select().from(policies).limit(1);
    if (existingPolicies.length > 0) return;

    const seedPolicies = await loadSeedJson<Policy[]>("policies.json");
    const seedCapabilities = await loadSeedJson<Capability[]>("capabilities.json");

    if (seedPolicies.length > 0) {
      await this.db
        .insert(policies)
        .values(
          seedPolicies.map((p) => ({
            policy_id: p.policy_id,
            version: p.version,
            name: p.name,
            rule_key: p.rule_key,
            description: p.description,
            severity: p.severity,
            enabled: p.enabled,
            action_on_violation: p.action_on_violation,
            effective_from: p.effective_from,
            change_reason: p.change_reason,
            change_log: p.change_log,
          })),
        )
        .onConflictDoNothing();
    }

    if (seedCapabilities.length > 0) {
      await this.db
        .insert(capabilities)
        .values(seedCapabilities.map(capabilityToRow))
        .onConflictDoNothing();
    }
  }

  async getIntakeById(id: string) {
    await this.ready;
    const rows = await this.db.select().from(intakes).where(eq(intakes.id, id)).limit(1);
    if (!rows[0]) return null;
    return rows[0].bundle_json as IntakeMissionBundle;
  }

  async getIntakeByIdempotencyKey(key: string) {
    await this.ready;
    const rows = await this.db
      .select()
      .from(intakes)
      .where(eq(intakes.idempotency_key, key))
      .limit(1);
    if (!rows[0]) return null;
    return rows[0].bundle_json as IntakeMissionBundle;
  }

  async listIntakes() {
    await this.ready;
    const rows = await this.db.select().from(intakes).orderBy(desc(intakes.updated_at));
    return rows.map((r) => r.bundle_json as IntakeMissionBundle);
  }

  async saveIntake(bundle: IntakeMissionBundle) {
    await this.ready;
    const createdAt = toDate(bundle.created_at) ?? new Date();
    const updatedAt = toDate(bundle.updated_at) ?? new Date();
    await this.db
      .insert(intakes)
      .values({
        id: bundle.intake_id,
        intake_version: bundle.intake_version,
        requester_id: bundle.requester_id,
        source: bundle.source,
        source_message_ref: bundle.source_message_ref,
        raw_request: bundle.raw_request,
        bundle_json: bundle,
        readiness_status: bundle.readiness_status,
        confirmed_by_user: bundle.confirmed_by_user,
        idempotency_key: bundle.idempotency_key,
        created_at: createdAt,
        updated_at: updatedAt,
      })
      .onConflictDoUpdate({
        target: intakes.id,
        set: {
          intake_version: bundle.intake_version,
          requester_id: bundle.requester_id,
          source: bundle.source,
          source_message_ref: bundle.source_message_ref,
          raw_request: bundle.raw_request,
          bundle_json: bundle,
          readiness_status: bundle.readiness_status,
          confirmed_by_user: bundle.confirmed_by_user,
          idempotency_key: bundle.idempotency_key,
          updated_at: updatedAt,
        },
      });
  }

  async getMissionById(id: string) {
    await this.ready;
    const rows = await this.db.select().from(missions).where(eq(missions.id, id)).limit(1);
    if (!rows[0]) return null;
    return rows[0].mission_json as MissionObject;
  }

  async getMissionByIntakeId(intakeId: string) {
    await this.ready;
    const rows = await this.db
      .select()
      .from(missions)
      .where(eq(missions.source_intake_id, intakeId))
      .limit(1);
    if (!rows[0]) return null;
    return rows[0].mission_json as MissionObject;
  }

  async getMissionByIntakeIdAndVersion(intakeId: string, intakeVersion: string) {
    await this.ready;
    const rows = await this.db
      .select()
      .from(missions)
      .where(
        and(
          eq(missions.source_intake_id, intakeId),
          eq(missions.source_intake_version, intakeVersion),
        ),
      )
      .limit(1);
    if (!rows[0]) return null;
    return rows[0].mission_json as MissionObject;
  }

  async listMissions() {
    await this.ready;
    const rows = await this.db.select().from(missions).orderBy(desc(missions.id));
    return rows.map((r) => r.mission_json as MissionObject);
  }

  async saveMission(mission: MissionObject) {
    await this.ready;
    const existing = await this.db
      .select({ created_at: missions.created_at })
      .from(missions)
      .where(eq(missions.id, mission.mission_id))
      .limit(1);
    const now = new Date();
    const createdAt = existing[0]?.created_at ?? now;

    await this.db
      .insert(missions)
      .values({
        id: mission.mission_id,
        object_version: mission.object_version,
        revision: mission.revision,
        source_intake_id: mission.source_intake_id,
        source_intake_version: mission.source_intake_version,
        mapping_version: mission.mapping_version,
        status: mission.status,
        planning_status: mission.planning_status,
        planning_revision: mission.planning_revision,
        last_planned_at: toDate(mission.last_planned_at),
        planning_reason: mission.planning_reason,
        criticality: mission.criticality,
        mission_json: mission,
        created_at: createdAt,
        updated_at: now,
      })
      .onConflictDoUpdate({
        target: missions.id,
        set: {
          object_version: mission.object_version,
          revision: mission.revision,
          source_intake_id: mission.source_intake_id,
          source_intake_version: mission.source_intake_version,
          mapping_version: mission.mapping_version,
          status: mission.status,
          planning_status: mission.planning_status,
          planning_revision: mission.planning_revision,
          last_planned_at: toDate(mission.last_planned_at),
          planning_reason: mission.planning_reason,
          criticality: mission.criticality,
          mission_json: mission,
          updated_at: now,
        },
      });
  }

  async getNotionSync(missionId: string) {
    await this.ready;
    const rows = await this.db
      .select()
      .from(notionSync)
      .where(eq(notionSync.mission_id, missionId))
      .limit(1);
    if (!rows[0]) return null;
    return rowToNotionSync(rows[0]);
  }

  async saveNotionSync(record: NotionSyncRecord) {
    await this.ready;
    const updatedAt = toDate(record.updated_at) ?? new Date();
    await this.db
      .insert(notionSync)
      .values({
        mission_id: record.mission_id,
        notion_page_id: record.notion_page_id,
        sync_status: record.sync_status,
        sync_attempt_id: record.sync_attempt_id,
        verified_by: record.verified_by,
        verified_at: toDate(record.verified_at),
        verification_method: record.verification_method,
        verification_version: record.verification_version,
        source_record_version: record.source_record_version,
        policy_decision_id: record.policy_decision_id,
        last_error: record.last_error,
        synced_at: toDate(record.synced_at),
        updated_at: updatedAt,
      })
      .onConflictDoUpdate({
        target: notionSync.mission_id,
        set: {
          notion_page_id: record.notion_page_id,
          sync_status: record.sync_status,
          sync_attempt_id: record.sync_attempt_id,
          verified_by: record.verified_by,
          verified_at: toDate(record.verified_at),
          verification_method: record.verification_method,
          verification_version: record.verification_version,
          source_record_version: record.source_record_version,
          policy_decision_id: record.policy_decision_id,
          last_error: record.last_error,
          synced_at: toDate(record.synced_at),
          updated_at: updatedAt,
        },
      });
  }

  async appendAudit(event: AuditEvent) {
    await this.ready;
    await this.db.insert(auditEvents).values({
      id: event.id,
      aggregate_type: event.aggregate_type ?? null,
      mission_id: event.mission_id,
      intake_id: event.intake_id,
      actor: event.actor,
      action: event.action,
      reason: event.reason,
      correlation_id: event.correlation_id,
      causation_id: event.causation_id ?? null,
      previous_state: event.previous_state,
      new_state: event.new_state,
      policy_result: event.policy_result,
      created_at: toDate(event.created_at) ?? new Date(),
    });
  }

  async listAudit(filter: { mission_id?: string; intake_id?: string; correlation_id?: string }) {
    await this.ready;
    const rows = await this.db.select().from(auditEvents).orderBy(desc(auditEvents.created_at));

    return rows
      .filter((e) => (filter.mission_id ? e.mission_id === filter.mission_id : true))
      .filter((e) => (filter.intake_id ? e.intake_id === filter.intake_id : true))
      .filter((e) => (filter.correlation_id ? e.correlation_id === filter.correlation_id : true))
      .map(rowToAudit);
  }

  async listPolicies() {
    await this.ready;
    const rows = await this.db.select().from(policies);
    return rows.map((r): Policy => ({
      policy_id: r.policy_id,
      version: r.version,
      name: r.name,
      rule_key: r.rule_key,
      description: r.description,
      severity: r.severity as Policy["severity"],
      enabled: r.enabled,
      action_on_violation: r.action_on_violation as Policy["action_on_violation"],
      effective_from: r.effective_from,
      change_reason: r.change_reason,
      change_log: (r.change_log as Policy["change_log"]) ?? [],
    }));
  }

  async listCapabilities() {
    await this.ready;
    const rows = await this.db.select().from(capabilities);
    return rows.map(rowToCapability);
  }
}
