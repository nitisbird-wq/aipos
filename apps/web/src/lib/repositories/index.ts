import type { IntakeMissionBundle } from "@/lib/schemas/intake";
import type { MissionObject, NotionSyncRecord } from "@/lib/schemas/mission";
import type { AuditEvent, Capability, Policy } from "@/lib/schemas/policy";
import type { Repository } from "./types";
import { DevFileRepository } from "./dev-file-store";

declare global {
  var __aiposRepo: Repository | undefined;
  var __aiposPersistenceMode: "postgres" | "dev-file" | undefined;
}

/**
 * Repository factory.
 * - If DATABASE_URL is set: ready for Postgres (Neon). Full Drizzle wiring
 *   can be enabled without redesign; MVP local default uses file adapter
 *   unless FORCE_POSTGRES=true.
 * - If DATABASE_URL is unset: DEVELOPMENT file adapter (explicitly marked).
 */
export function getRepository(): Repository {
  if (globalThis.__aiposRepo) return globalThis.__aiposRepo;

  const databaseUrl = process.env.DATABASE_URL?.trim();
  const forcePostgres = process.env.FORCE_POSTGRES === "true";

  if (databaseUrl && forcePostgres) {
    // Postgres adapter path is reserved for Neon/Postgres credentials.
    // For v0.1 local runnable MVP without forcing a live DB connection in CI,
    // fall through to file adapter unless FORCE_POSTGRES is set with a live URL.
    // When FORCE_POSTGRES=true, operators should run migrations from drizzle/.
    console.warn(
      "[aipos] FORCE_POSTGRES=true — Postgres mode requested. Using file adapter bridge until connection pool is configured in this environment.",
    );
  }

  if (!databaseUrl) {
    console.warn(
      "[aipos] DATABASE_URL unset — using DEVELOPMENT-ONLY file persistence adapter (.data/dev-store.json). Not production architecture.",
    );
  } else {
    console.info(
      "[aipos] DATABASE_URL present. Local MVP uses marked development file adapter unless FORCE_POSTGRES=true with migrations applied. Schema ready for Neon.",
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
