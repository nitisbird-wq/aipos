#!/usr/bin/env tsx
/**
 * Apply all apps/web/drizzle/*.sql files in sorted order against DATABASE_URL.
 * Idempotent (CREATE IF NOT EXISTS). Non-destructive for existing data.
 *
 * Usage:
 *   DATABASE_URL=postgresql://aipos:aipos_dev_only@localhost:5432/aipos npm run db:migrate -w web
 */
import { readdirSync, readFileSync } from "fs";
import path from "path";
import postgres from "postgres";

async function main() {
  const url = process.env.DATABASE_URL?.trim();
  if (!url) {
    console.error("DATABASE_URL is required");
    process.exit(1);
  }

  const dir = path.resolve(__dirname, "../drizzle");
  const files = readdirSync(dir)
    .filter((f) => f.endsWith(".sql"))
    .sort();

  if (files.length === 0) {
    console.error(`No .sql files in ${dir}`);
    process.exit(1);
  }

  const sql = postgres(url, { max: 1, prepare: false, onnotice: () => {} });
  try {
    for (const file of files) {
      const sqlPath = path.join(dir, file);
      const ddl = readFileSync(sqlPath, "utf8");
      await sql.unsafe(ddl);
      console.log(`[aipos] Applied ${sqlPath}`);
    }
  } finally {
    await sql.end({ timeout: 5 });
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
