# Stage 7 Live Execution Gate

Date: 2026-08-31  
Scope: PR #21 branch `cursor/master-continuity-strategy-169c`  
Status: **UNVERIFIED — Owner-local preflight passed; draft review / live execution pending**

## Current state

Stages 0–6 are implemented and verified on the Draft PR branch. CI #143 completed SUCCESS for the final Stage 0–6 documentation head. CI #145 completed SUCCESS for the read-only Linear preflight (secret scan, format, lint, 112 tests, build, AIPOS Doctor, and dependency audit). Stage 7 must begin with a real Linear end-to-end dispatch according to the approved execution order.

## Credential and connection preflight

| Requirement | Result |
| --- | --- |
| Connected Linear workspace | Read-only authenticated connection available |
| Target team | Verified: `Nitis Pro : AIPOS` |
| `LINEAR_TEAM_ID` | Verified: `acee324a-f2d8-416d-96ef-237298e82986` |
| `LINEAR_ADAPTER=live` | Not configured in the available code execution runtime |
| `LINEAR_API_KEY` | Not configured; Owner must add through a local/runtime secret store |
| Read-only runtime preflight | `npm run linear:preflight` |
| Live adapter contract | Implemented; GraphQL and team-access errors fail closed |
| External writes performed | None |

No secret value was read, printed, inferred, committed, or requested in chat.

## Human Gate

Historical setup instructions below apply only to a runtime not yet configured. Owner-local preflight at `cc7325b` already passed (`ok=true`, live, authenticated, expected team, `write_performed=false`). Do not ask Owner to repeat setup. The coding environment does not inherit Owner credentials or store.

For the documented local Windows runtime:

1. Copy `.env.example` to `apps/web/.env.local` if that file does not already exist.
2. Set `LINEAR_ADAPTER=live`.
3. Set `LINEAR_API_KEY` to the Linear personal API key.
4. Set `LINEAR_TEAM_ID=acee324a-f2d8-416d-96ef-237298e82986`.
5. Run `npm.cmd run linear:preflight`.

A successful preflight reports authenticated/team metadata and `write_performed: false`. It never prints the API key.

## Next executable action after unblocking

1. Confirm the read-only preflight succeeds.
2. Select a reversible test mission with an approved Blueprint and verified capability route.
3. Dispatch one idempotent Linear test workstream.
4. Verify returned issue/team identifiers and reconciliation mapping.
5. Record evidence; do not delete/archive the external issue without explicit authority.
6. Continue to Real Worker Execution only after Linear E2E passes.

## Prohibited claims

Until the write/readback evidence exists, Real Linear E2E, Real Worker Execution, Health/Recovery live runtime, n8n integration, Full Mission E2E, and Production Gate remain unverified.

## 2026-09-02 — Existing draft correction defect / decision / handoff

**Evidence:** Owner screenshots show sensitivity acknowledged and constraints appended, but unchanged generic docs WS1/WS2; source at `cc7325b` confirms the Advanced form is disabled when intake ID exists and Correct understanding only inserts a hint. This is a verified app defect (AC product #2), not permission to reopen frozen production Phase 1–2.

**Decision:** use the existing `correctIntake` service and conversation store; add a strict, restricted chat correction boundary and prefilled editor. Keep original request/ID/idempotency, risk/sensitivity and approval requirements. No alternate store, migration, credential change, new ADR or auto-approval. Replay with an old timestamp is rejected rather than duplicated. Read-only resume supports the existing ID after reload; no automatic create fallback.

**Local evidence (isolated DEV fixtures, not Owner data):**

- Full Vitest: 116 passed, 7 Postgres tests skipped (123 total); includes 11 new service/API regression tests. Newly introduced sensitivity escalates and requires fresh acknowledgment; existing flags/risk are never automatically cleared.
- Lint: passed.
- Build and format check: passed locally. No deployment performed.
- Doctor: blocked before execution by environment permission `listen EPERM` for tsx IPC; no permission workaround attempted. Must run in the normal CI/authorized local environment before claiming complete verification.
- Browser/Owner runtime, real Linear writes/readback, workers: not tested here.

**Remaining backlog / next executable actions:**

1. Finish build/format/CI evidence; keep PR Draft, no merge/deploy.
2. Owner runtime can reopen `/intake?intake_id=INT-5D7A2B1143C8`, edit the existing draft, save and read back; do not use New mission. This is an Owner-local ID from prior evidence, not a record in the coding workspace.
3. Review exact one-workstream Blueprint/routing against downstream re-decomposition before live dispatch. ADR-007 remains reserved; do not silently change routing policy or clear sensitivity/risk based on a text heuristic.
4. Strengthen concurrent-edit handling with repository-level atomic version checks before multi-process production use (current timestamp guard is sequential only).
5. Then one reversible Linear E2E with `simulate_worker_pass=false`, approved Blueprint and verified route; only after real evidence continue the established Worker → Health → Recovery → Full E2E → n8n → Production Gate order.

**Rollback:** revert the bounded code change; existing records remain valid under the unchanged IntakeMissionBundle schema. No production/runtime data is deleted. Reverting removes resume/editor support but does not reverse edits already saved by an Owner.
