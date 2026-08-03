# Developer Control Center

Local/Git-native tooling so operators can check GitHub PR/CI truth and bring up the local stack with a few commands.

**Does not change** business logic or `docs/AIPOS_ARCHITECTURE_CONTRACT.md`.

## Prerequisites

| Tool | Required for | Install (Windows) |
|---|---|---|
| Node 20+ | all npm scripts | https://nodejs.org/ |
| GitHub CLI `gh` | `npm run status` PR/CI SoT | `winget install --id GitHub.cli` then `gh auth login` — **not auto-installed** |
| Docker Desktop | `npm run services:up` | https://www.docker.com/products/docker-desktop/ |
| Bruno (optional) | GUI for `bruno/aipos` | https://www.usebruno.com/ |

## Three-command happy path

```bash
npm run services:up
npm run status
npm run verify
```

Typical day-to-day:

```bash
npm run services:up
# apply DB if using Postgres mode:
# DATABASE_URL=postgresql://aipos:aipos_dev_only@localhost:5432/aipos npm run db:migrate -w web
npm run dev
# other terminal:
npm run test:api
```

## Commands

| Script | Purpose |
|---|---|
| `npm run status` | Branch, dirty files, `origin/main` SHA, open PRs, **`gh pr view --json` mergedAt**, CI rollup, dependency order, Docker/PG/n8n/app probes |
| `npm run services:up` | `docker compose -f docker-compose.yml up -d` (Postgres + n8n, healthchecks, volumes) |
| `npm run services:down` | Stop stack (volumes kept) |
| `npm run test:api` | Bruno collection under `bruno/aipos` (login → intake → confirm → mission + placeholders) |
| `npm run verify` | status + format:check + lint + test + build + doctor `--profile pr` |

## PR merge source of truth

`npm run status` uses **`gh pr view --json state,mergedAt,baseRefName,mergeCommit,...`**.  
Do **not** trust agent chat memory for “PR is merged”.

Also checks whether `mergeCommit` is an ancestor of `origin/main` (catches merges into a non-`main` base, e.g. stacked PR #10).

## Compose files

| File | Role |
|---|---|
| `docker-compose.yml` | **Preferred** — Postgres + n8n (dev placeholders) |
| `docker-compose.postgres.yml` | Postgres-only legacy (docs Option A) |

Credentials are **dev placeholders only** (`aipos` / `aipos_dev_only`). Never production.

## Bruno collections

Git-native under `bruno/aipos/`:

- auth/login
- intake create / analyze / confirm
- mission list / get
- planning / assignment / execution **placeholders** (404 expected until those phases land)

Env: `bruno/aipos/environments/local.bru` (`baseUrl=http://localhost:3000`).

## Out of scope

Planning/Assignment/Execution implementation, Architecture Contract edits, production credentials, auto-merge.
