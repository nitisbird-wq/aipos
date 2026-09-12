# Nitis Pro AIPOS

Mission Operating System — **Mission Intake MVP v0.1** (Phases 1–2 production pass recorded).

## Production status (operational truth)

Canonical snapshot (update in Notion; do not duplicate as a second CURRENT STATE doc):

- [AIPOS CURRENT STATE](https://app.notion.com/p/3cdbc165be4c81c48e73e5899ae5f0e3)

| Item | Status |
|---|---|
| Phase 1 | **PRODUCTION PASS** |
| Phase 2 | **PRODUCTION PASS** |
| Active workflow | AIPOS — Mission Intake Pilot v0.1 |
| Workflow ID | `7fLPHiiyt7sre5RR` |
| Active version | `760150d8-2e1a-4a5e-93a9-48781c306583` |
| Smoke | execution 37 / MIS-3 / NIT-9 |
| Notion writeback | **PASS** |
| Duplicates | **0** |
| Phase 1 regression | **NO** |
| Rollback ready | **YES** |

Production Mission Intake runs via the frozen n8n workflow above. Agents must not modify that workflow, Notion Mission/Project registries, or Linear unless the Owner explicitly authorizes it.

## What this repo contains

- Approved docs, JSON schemas, and seed data (`docs/`, `packages/schemas/`, `data/seeds/`)
- Runnable Next.js app (`apps/web`) implementing Intake → Understanding → Confirm → Mission → Notion sync contract (local default: mock adapter)
- ADRs including Control Tower ([ADR-006](adr/ADR-006-AIPOS-CONTROL-TOWER.md)) and reserved Capability Orchestration ([ADR-007](adr/ADR-007-AIPOS-CAPABILITY-ORCHESTRATION.md))

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

PostgreSQL mode is Phase 2 Runtime Foundation (Intake / Mission / Audit / Notion sync state). Phase 2 is **PRODUCTION PASS** for the operational Mission Intake path; local Postgres remains opt-in. It does **not** include Planning, Assignment, or Execution (Phase 3+).

### Notion (local / CI vs production)

| Context | Behavior |
|---|---|
| **Local / CI (default)** | `NOTION_ADAPTER=mock` — no real Notion writes from the Next.js app. `mock_synced` must never be presented as verified. |
| **Production operational path** | Mission Intake Pilot n8n writeback to Notion is **PASS** (see Production status). App → Notion verified sync still requires real credentials + readback id when using the live adapter. |

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
## Out of scope (v0.1 / current Phase 3 gate)

Specialist execution, Phase 3 routing/dispatcher expansion, real Subtask creation as Intake MVP work, and unattended production deploy. Capability Orchestration is reserved under ADR-007 and blocked until Mission Decomposer is approved.

## Phase 1.0 direction (approved decisions)

See `docs/AIPOS_PHASE_1_DECISIONS.md` (Know-Me, Hard Control, Tool Chain).  
Enforceable MVP constraints: `docs/AIPOS_ARCHITECTURE_CONTRACT.md`.  
Notion capture: [AIPOS-ADR-004](https://app.notion.com/p/3afbc165be4c811bbdd1c8d7101a6013).

## Git baseline (first commits)

Do **not** land the entire working tree as one commit. Follow `docs/GIT_BASELINE_SPLIT.md` on branch `chore/initial-aipos-baseline`.  
Agents must follow `AGENTS.md` (locked decisions, SoT boundaries, Doctor before handoff).

## Docs

See `docs/IMPLEMENTATION_PLAN.md`, `docs/ACCEPTANCE_CRITERIA.md`, and Phase 1 decision docs above.
