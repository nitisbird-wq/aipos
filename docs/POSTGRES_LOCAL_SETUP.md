# Local PostgreSQL setup (Phase 2 Runtime Foundation)

App DB is the runtime SSOT for intakes, missions, audit, and Notion sync/verification metadata.
This guide enables **local / non-production** Postgres mode. Do not point `DATABASE_URL` at production.

Authoritative schema: `apps/web/drizzle/0000_init.sql` (aligned with `docs/DATABASE_SCHEMA.md`).

## Option A — Docker Compose

```bash
docker compose -f docker-compose.postgres.yml up -d
```

Creates:

| Database | Purpose |
|---|---|
| `aipos` | Local app runtime |
| `aipos_test` | Vitest contract / PG adapter tests |

Credentials in the compose file are **dev placeholders only**.

## Option B — Native PostgreSQL

```bash
# Debian/Ubuntu example
sudo apt-get install -y postgresql postgresql-contrib
sudo -u postgres createuser -s aipos || true
sudo -u postgres psql -c "ALTER USER aipos PASSWORD 'aipos_dev_only';"
sudo -u postgres createdb -O aipos aipos || true
sudo -u postgres createdb -O aipos aipos_test || true
```

## Apply migration (idempotent, non-destructive)

```bash
export DATABASE_URL=postgresql://aipos:aipos_dev_only@localhost:5432/aipos
npm run db:migrate -w web
```

Applies `apps/web/drizzle/0000_init.sql` (`CREATE TABLE IF NOT EXISTS` / `CREATE INDEX IF NOT EXISTS`).

Repeat for the test DB if needed:

```bash
DATABASE_URL=postgresql://aipos:aipos_dev_only@localhost:5432/aipos_test npm run db:migrate -w web
```

## Enable Postgres mode in the app

Copy `.env.example` → `apps/web/.env.local` and set:

```bash
DATABASE_URL=postgresql://aipos:aipos_dev_only@localhost:5432/aipos
FORCE_POSTGRES=true
```

Then `npm run dev`. Session / mission list responses should report `persistence_mode: "postgres"` / `adapterName: "postgres"`.

Leave `FORCE_POSTGRES=false` (or unset `DATABASE_URL`) to keep the DEV file adapter.

## Run Postgres repository tests

```bash
export AIPOS_TEST_DATABASE_URL=postgresql://aipos:aipos_dev_only@localhost:5432/aipos_test
npm test
# or only repository tests:
npm run test:pg -w web
```

Without `AIPOS_TEST_DATABASE_URL` / `AIPOS_RUN_PG_TESTS`, Postgres contract suites are skipped; file-adapter and existing service tests still run.

## Out of scope (this phase)

Planning engine, Subtasks, Assignment, Specialist execution, n8n, real Notion credentials, production connections.
