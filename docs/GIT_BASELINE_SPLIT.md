# Git baseline split plan (pre-first-commit)

**Status:** Binding guidance until initial baseline lands  
**Branch:** `chore/initial-aipos-baseline` (preferred over committing on `master`)  
**Do not:** squash the entire working tree (~18k+ lines / 100+ files) into one unreviewable commit when avoidable.

## Preconditions (before any commit)

```powershell
npm.cmd run doctor
git status --short
```

Must remain **out of commit**:

- `.env`, `.env.local`, secrets
- `node_modules/`, `.next/`, `.data/`, logs
- `AIPOS_AUDIT_REPORT.md` (generated; gitignored)

`.env.example` is allowed.

## Recommended commit series

| # | Intent | Include (examples) |
|---|---|---|
| 1 | Governance and architecture documents | `docs/**` (incl. `AIPOS_ARCHITECTURE_CONTRACT.md`), `AGENTS.md`, `README.md`, `adr/**` (text ADRs preferred over `.docx`), root `.gitignore` |
| 2 | Schemas and domain contracts | `packages/schemas/**`, `data/seeds/**`, schema docs |
| 3 | Mission Intake application | `apps/web/**` (app, gates, services, UI) |
| 4 | Know-Me / Phase 1 decision docs already in #1; orchestration **code** later | defer implementation commits until Hard Control lands |
| 5 | Tests and developer tooling | Vitest/Playwright configs already under `apps/web`; `scripts/aipos/**`, `.github/**`, `package.json`, lockfile, `start-dev.cmd` |

Notes:

- On a repo with **no commits yet**, Commit 1 may also need root `package.json` / workspace scaffolding if later commits cannot build otherwise — prefer smallest scaffold in #1 and full app in #3–5.
- Prefer conventional commits: `docs:`, `feat:`, `chore:`, `test:`.
- After first commit, rename default branch to `main` when remote is ready (Doctor warning).

## Verification after each commit

```powershell
npm.cmd run doctor
npm.cmd test
```

## Explicit non-goals for baseline commits

- Enabling production Notion/LLM credentials
- Claiming ADR-004 Notion `Verified=true` without mission-owner evidence fields
- Implementing open questions by guess
