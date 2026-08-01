# Implementation Plan — Mission Intake MVP v0.1

## Stack (locked for MVP)

| Layer | Choice |
|---|---|
| App | Next.js (App Router) + TypeScript |
| Validation | Zod (+ JSON Schema export) |
| Database | PostgreSQL (Neon recommended on Vercel) |
| ORM | Prisma or Drizzle |
| Auth | Simple operator session |
| Notion | Official SDK |
| Test | Vitest + Playwright |
| Deploy | Vercel |
| Repo | GitHub |

### Why not SQLite on Vercel

Serverless instances are ephemeral; SQLite files do not provide reliable multi-instance persistence. Postgres via Neon/Supabase is the practical default.

## Phases

### Phase A — Scaffold (this package complete)

Docs, schemas, seeds, repo structure, `.env.example`.

### Phase B — App skeleton

- Next.js app under `apps/web`
- DB migrations for intakes, missions, audit, sync, policies, capabilities
- Seed policies + capabilities

### Phase C — Intake API + UI

- Create intake, analyze (deterministic heuristic stub; optional LLM later behind flag)
- Understanding screen with correct/confirm/cancel
- Readiness transitions

### Phase D — Mapping + Audit

- Mapping Gate service
- Mission create
- Transition commands + audit_events

### Phase E — Notion sync

- Verified write + retry + dashboard badge

### Phase F — Dashboard / Detail / Governance

- List, detail, policy viewer
- Responsive polish

### Phase G — Deploy

- GitHub remote, Vercel project, env vars, smoke test

## Analyze stub policy

v0.1 may use rule-based analysis (keyword → families/risk) so the product works without calling external LLMs. Optional `ANALYZE_PROVIDER=openai|none` for later.

## Definition of done

See `ACCEPTANCE_CRITERIA.md` product section.
