#!/usr/bin/env tsx
/**
 * Apply apps/web/drizzle/0000_init.sql against DATABASE_URL.
 * Idempotent (CREATE IF NOT EXISTS). Non-destructive for existing data.
 *
 * Usage (from repo root or apps/web):
 *   DATABASE_URL=postgresql://aipos:aipos_dev_only@localhost:5432/aipos npm run db:migrate -w web
 */
import { readFileSync } from "fs";
import path from "path";
import postgres from "postgres";

async function main() {
  const url = process.env.DATABASE_URL?.trim();
  if (!url) {
    console.error("DATABASE_URL is required");
    process.exit(1);
  }

  const sqlPath = path.resolve(__dirname, "../drizzle/0000_init.sql");
  const ddl = readFileSync(sqlPath, "utf8");

  const sql = postgres(url, { max: 1, prepare: false });
  try {
    await sql.unsafe(ddl);
    console.log(`[aipos] Applied ${sqlPath}`);
  } finally {
    await sql.end({ timeout: 5 });
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
