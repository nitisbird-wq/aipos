# Nitis Pro AIPOS

Mission Operating System — **Mission Intake MVP v0.1**.

## What this repo contains

- Approved docs, JSON schemas, and seed data (`docs/`, `packages/schemas/`, `data/seeds/`)
- Runnable Next.js app (`apps/web`) implementing Intake → Understanding → Confirm → Mission → Notion (mock)

## Stack

Next.js 15 (App Router) + TypeScript + Zod + Drizzle schema (PostgreSQL/Neon-ready) + Vitest + Playwright

## Local setup

```bash
cd C:\Users\nitis\Documents\aipos
npm install
cp .env.example apps/web/.env.local
# Edit OPERATOR_PASSWORD / NEXTAUTH_SECRET as needed. Leave DATABASE_URL empty for DEV file store.
npm run dev
```

### Developer Control Center (PR/CI + local stack)

See [`docs/DEVELOPER_CONTROL_CENTER.md`](docs/DEVELOPER_CONTROL_CENTER.md). Typical three commands:

```bash
npm run services:up   # Postgres + n8n (Docker; optional)
npm run status        # git + gh PR/CI SoT + service health
npm run verify        # status + format/lint/test/build/doctor
```

`npm run status` uses **`gh pr view --json`** as PR merge source of truth (install GitHub CLI yourself on Windows — this repo will not auto-install it).

Open [http://localhost:3000](http://localhost:3000) → **Mission Commander** (chat-first New Mission). Sign in with:

- Email: `operator@example.com` (or `OPERATOR_EMAIL`)
- Password: value of `OPERATOR_PASSWORD` (default in code when unset: `dev-password` for local only)

### Routes

| Path | Purpose |
|---|---|
| `/intake` | **Chat-first Mission Commander** (primary) |
| `/intake/[id]/understanding` | Legacy pointer / deep-link note |
| `/missions` | Mission Dashboard |
| `/missions/[id]` | Mission Control / Detail |
| `/governance` | Read-only Policy Registry |

### Persistence mode

| Condition | Behavior |
|---|---|
| `DATABASE_URL` unset | **Development-only** file adapter at `apps/web/.data/dev-store.json` (explicitly marked in UI/logs) |
| `DATABASE_URL` set + `FORCE_POSTGRES=true` | **PostgreSQL runtime adapter** (App DB SSOT). Apply `apps/web/drizzle/0000_init.sql` first — see `docs/POSTGRES_LOCAL_SETUP.md` |
| `DATABASE_URL` set, `FORCE_POSTGRES` not true | File adapter remains active (opt-in required; schema ready) |

PostgreSQL mode is Phase 2 Runtime Foundation (Intake / Mission / Audit / Notion sync state). It does **not** include Planning, Assignment, or Execution.

### Notion

Default `NOTION_ADAPTER=mock`. No real Notion writes. Sync success is shown only when a verified page/record ID exists.

### Useful commands

```bash
npm run lint
npm run test
npm run build
npm run format -w web
npm run doctor
npm run aipos -- doctor --profile local
npm run aipos -- doctor --profile pr
# Postgres (optional local):
# npm run db:migrate -w web
# AIPOS_TEST_DATABASE_URL=postgresql://aipos:aipos_dev_only@localhost:5432/aipos_test npm test
# Optional E2E (install browsers first):
# npx playwright install
# npm run test:e2e -w web
```

Agent rules: see `AGENTS.md`.
## Out of scope (v0.1)

Specialist execution, routing/matching/assignment, real Subtask creation, real Notion/AI credentials, deploy.

## Phase 1.0 direction (approved decisions)

See `docs/AIPOS_PHASE_1_DECISIONS.md` (Know-Me, Hard Control, Tool Chain).  
Enforceable MVP constraints: `docs/AIPOS_ARCHITECTURE_CONTRACT.md`.  
Notion capture: [AIPOS-ADR-004](https://app.notion.com/p/3afbc165be4c811bbdd1c8d7101a6013).

## Git baseline (first commits)

Do **not** land the entire working tree as one commit. Follow `docs/GIT_BASELINE_SPLIT.md` on branch `chore/initial-aipos-baseline`.  
Agents must follow `AGENTS.md` (locked decisions, SoT boundaries, Doctor before handoff).

## Docs

See `docs/IMPLEMENTATION_PLAN.md`, `docs/ACCEPTANCE_CRITERIA.md`, and Phase 1 decision docs above.
