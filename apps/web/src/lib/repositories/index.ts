import type { IntakeMissionBundle } from "@/lib/schemas/intake";
import type { MissionObject, NotionSyncRecord } from "@/lib/schemas/mission";
import type { AuditEvent, Capability, Policy } from "@/lib/schemas/policy";
import type { Repository } from "./types";
import { DevFileRepository } from "./dev-file-store";
import { PostgresRepository } from "./postgres-store";

declare global {
  var __aiposRepo: Repository | undefined;
  var __aiposPersistenceMode: "postgres" | "dev-file" | undefined;
}

/**
 * Repository factory.
 * - DATABASE_URL unset → DEVELOPMENT file adapter (explicitly marked).
 * - DATABASE_URL set + FORCE_POSTGRES=true → PostgreSQL adapter (App DB runtime SSOT).
 * - DATABASE_URL set without FORCE_POSTGRES → file adapter (schema ready; opt-in required).
 */
export function getRepository(): Repository {
  if (globalThis.__aiposRepo) return globalThis.__aiposRepo;

  const databaseUrl = process.env.DATABASE_URL?.trim();
  const forcePostgres = process.env.FORCE_POSTGRES === "true";

  if (databaseUrl && forcePostgres) {
    console.info(
      "[aipos] FORCE_POSTGRES=true with DATABASE_URL — using PostgreSQL runtime adapter.",
    );
    const repo = new PostgresRepository();
    globalThis.__aiposRepo = repo;
    globalThis.__aiposPersistenceMode = "postgres";
    return repo;
  }

  if (!databaseUrl) {
    console.warn(
      "[aipos] DATABASE_URL unset — using DEVELOPMENT-ONLY file persistence adapter (.data/dev-store.json). Not production architecture.",
    );
  } else {
    console.info(
      "[aipos] DATABASE_URL present but FORCE_POSTGRES is not true — using marked development file adapter. Set FORCE_POSTGRES=true after applying drizzle/0000_init.sql to enable Postgres mode.",
    );
  }

  const repo = new DevFileRepository();
  globalThis.__aiposRepo = repo;
  globalThis.__aiposPersistenceMode = "dev-file";
  return repo;
}

export function getPersistenceMode(): "postgres" | "dev-file" {
  getRepository();
  return globalThis.__aiposPersistenceMode ?? "dev-file";
}

export type {
  Repository,
  IntakeMissionBundle,
  MissionObject,
  NotionSyncRecord,
  AuditEvent,
  Capability,
  Policy,
};

export { DevFileRepository } from "./dev-file-store";
export { PostgresRepository } from "./postgres-store";
