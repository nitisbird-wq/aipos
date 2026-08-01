# AGENTS.md — AIPOS Agent Operating Rules

This file binds Cursor, Claude, and other coding agents working in this repository.

## Before changing code

1. Read the binding docs for the task (minimum set):
   - `docs/AIPOS_PHASE_1_DECISIONS.md` (locked Phase 1 decisions / ADR-004)
   - `docs/AIPOS_ARCHITECTURE_CONTRACT.md` (**enforceable** verification, ownership, idempotency, sync failure)
   - `docs/OPERATOR_PROFILE_AND_KNOW_ME.md`
   - `docs/HARD_CONTROL_AND_ANTI_HALLUCINATION.md`
   - `docs/OPEN_QUESTIONS_AND_ASSUMPTIONS.md`
   - `docs/AIPOS_ARCHITECTURE.md`
   - `docs/AIPOS_MVP_SCOPE.md`
   - `docs/ACCEPTANCE_CRITERIA.md` / `docs/API_CONTRACT.md`
   - `docs/SECURITY_AND_PERMISSIONS.md`
   - relevant files under `adr/`
2. Prefer existing contracts in `packages/schemas/` and seeds in `data/seeds/`.
3. Do not invent product scope, gates, or mission semantics that conflict with those docs.
4. Cite a Requirement ID, Decision ID (e.g. `D1`–`D6`), Architecture Contract section, or ADR when changing behavior.

## Source-of-truth boundaries (do not blur)

| Store | SSOT for |
|---|---|
| **GitHub / this repo** | Code, schemas, ADRs (markdown), architecture docs, CI, release artifacts |
| **Notion** | Operator profile / Identity-Role knowledge, Mission Registry (human ops), operational knowledge |
| **App Database** | Runtime transactions: intakes, missions, audit, sync status, execution jobs |

Never say “SSOT” without naming the data class. Git does not own operator memory; Notion does not own application runtime state.

## Hard rules

- **No silent scope expansion.** If the request would change MVP scope, architecture, or governance, stop and ask.
- **No changing locked decisions without ADR.** Do not alter Phase 1 locked decisions (`docs/AIPOS_PHASE_1_DECISIONS.md`) or approved ADRs without a new ADR and human approval.
- **Assumptions are not facts.** Items in `docs/OPEN_QUESTIONS_AND_ASSUMPTIONS.md` stay assumptions until marked resolved with evidence.
- **Do not implement open questions by guessing.** Resolve with the mission owner or document a non-blocking assumption first.
- **No hardcoded secrets.** Use env vars / `.env.example` placeholders only. Never commit `.env`, `.env.local`, keys, tokens, or live credentials.
- **Three-State honesty.** Do not claim external sync/success without verified readback (`external_verified`).
- **Epistemic honesty.** Do not present `inferred` / `hypothesis` / `unknown` as confirmed facts.
- **Respect Architecture Contract.** Do not blur SoT, skip idempotency, treat Notion as runtime DB, or grant ChatGPT confirm/dispatch authority.
- **Status vocabulary.** `mission.status=ready` means ready_for_planning; bundle `ready_to_dispatch` means ready_to_map — not specialist dispatch.
- **Tests follow business logic.** When gates, transitions, intake/chat services, or schemas change, update or add Vitest coverage in the same change.
- **Report impact.** Call out architecture, data model, security, and rollback impact in the response when those areas are touched.
- **No production deploy.** Agents must not deploy to production, mutate live Notion/Neon, or rotate production secrets unless a human explicitly requests it and provides the target.
- **Stay in scope.** Do not edit unrelated files “for cleanup” without a clear reason tied to the task.
- **Split large baselines.** Do not land ~entire-repo changes as one unreviewable commit when avoidable; follow `docs/GIT_BASELINE_SPLIT.md` for initial baseline.
- **Run Doctor before handoff.** Before claiming work complete, run:

  ```bash
  npm.cmd run doctor
  # or with profile:
  npm.cmd run aipos -- doctor --profile local
  ```

## Preferred stack / boundaries

- App: `apps/web` (Next.js App Router)
- Control plane stays in AIPOS Core — not ChatGPT, Notion, or n8n as decision authority
- Tool chain (routing preference): ChatGPT → Claude → Cursor → n8n → Notion (see Phase 1 D1)
- Default local: DEV file store, `NOTION_ADAPTER=mock`, `ANALYZE_PROVIDER=none`
- n8n is planned for later execution phases; do not add empty n8n stubs only to satisfy audits

## Commands agents should know

```bash
npm.cmd install
npm.cmd run doctor
npm.cmd test
npm.cmd run lint
npm.cmd run build
npm.cmd run format:check
```

On Windows PowerShell, prefer `npm.cmd` if `npm` is blocked by execution policy.
