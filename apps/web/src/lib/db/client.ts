import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres, { type Sql } from "postgres";
import * as schema from "./schema";

export type AiposDb = PostgresJsDatabase<typeof schema>;

declare global {
  var __aiposPgSql: Sql | undefined;
  var __aiposPgDb: AiposDb | undefined;
}

/**
 * Shared Postgres connection (Neon / local).
 * Only used when FORCE_POSTGRES=true and DATABASE_URL is set.
 * Not production credentials — callers must supply a non-production URL.
 */
export function getSql(databaseUrl?: string): Sql {
  const url = (databaseUrl ?? process.env.DATABASE_URL)?.trim();
  if (!url) {
    throw new Error("DATABASE_URL is required for Postgres persistence mode");
  }
  if (globalThis.__aiposPgSql) return globalThis.__aiposPgSql;
  const sql = postgres(url, {
    max: 5,
    prepare: false,
    idle_timeout: 20,
    connect_timeout: 10,
  });
  globalThis.__aiposPgSql = sql;
  return sql;
}

export function getDb(databaseUrl?: string): AiposDb {
  if (globalThis.__aiposPgDb) return globalThis.__aiposPgDb;
  const sql = getSql(databaseUrl);
  const db = drizzle(sql, { schema });
  globalThis.__aiposPgDb = db;
  return db;
}

/** Test / process teardown helper. */
export async function closeDb(): Promise<void> {
  if (globalThis.__aiposPgSql) {
    await globalThis.__aiposPgSql.end({ timeout: 5 });
  }
  globalThis.__aiposPgSql = undefined;
  globalThis.__aiposPgDb = undefined;
}
