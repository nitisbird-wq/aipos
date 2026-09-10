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
4. The DEV file adapter now serializes in-process whole-store mutations and uses temp-file atomic rename. Multi-process optimistic concurrency/version checks remain required before treating a file adapter as production-safe; production architecture remains PostgreSQL.
5. Then one reversible Linear E2E with `simulate_worker_pass=false`, approved Blueprint and verified route; only after real evidence continue the established Worker → Health → Recovery → Full E2E → n8n → Production Gate order.

**Rollback:** revert the bounded code change; existing records remain valid under the unchanged IntakeMissionBundle schema. No production/runtime data is deleted. Reverting removes resume/editor support but does not reverse edits already saved by an Owner.

## 2026-09-09 — DEV store lost-update evidence and containment

**Observed state:** Owner readback shows the previous two-workstream bundle with `sensitivity_acknowledged=true`. Read-only searches returned no matching intake audit events and no correction/ack conversation markers. The corrected bundle therefore cannot be recovered from the available DEV store history.

**Cause and decision:** `DevFileRepository` used separate whole-file read/modify/direct-write cycles for intake, mission, sync, and audit mutations. Overlap could commit stale snapshots. Keep the canonical store and schema; serialize mutations per file and atomically replace the JSON from a unique temporary file. Do not create a second Source of Truth and do not infer that the missing history passed.

**Evidence:**

- New concurrency regression: 24 simultaneous audit appends split across two repository instances are all retained; JSON parses and no temporary files remain.
- Existing-draft correction followed by new-sensitivity acknowledgment preserves the corrected work map.
- Full web suite: 118 passed, 7 PostgreSQL-only tests skipped.
- ESLint, Prettier, and production build: passed. Build emitted recoverable stale webpack-cache warnings and completed successfully.

**Health/drift:** code-level lost-update containment is PASS for one Node.js process. Owner record reconciliation is BLOCKED pending deployment-free local pull/restart, same-intake repair, and readback. Cross-process file locking is not provided; PostgreSQL remains the production transaction boundary.

**Human Gate:** keep `INT-5D7A2B1143C8` unconfirmed. After readback proves the intended corrected bundle, review Blueprint/routing and obtain the existing ADR-007 architecture approval before any Real Linear write.

## 2026-09-09 — CI critical dependency gate

- CI #153 passed secret scan, format, lint, unit/PostgreSQL tests, build, and AIPOS Doctor, then failed the critical audit because Next.js `15.5.22` was covered by a newly published critical RCE advisory.
- Bounded remediation: patch upgrade to Next.js `15.5.25`; no feature, schema, mission state, deployment, or Phase 1–2 workflow behavior changed.
- Local verification after the patch: 118 tests passed, 7 PostgreSQL-gated tests skipped, lint/format/build passed, and `npm audit --audit-level=critical` reports no critical vulnerabilities. Remaining high/moderate advisories stay visible and require separate compatibility review.

## 2026-09-10 — same-intake authentication resume

- **Observed blocker:** opening `/intake?intake_id=INT-5D7A2B1143C8` after session expiry produced API 401, then login discarded the deep link and returned the Owner to a blank New Mission screen.
- **Contained defect:** unauthorized Mission Commander requests now send a sanitized internal return path to login; successful authentication resumes the original intake URL. External/open redirects are rejected.
- **Evidence:** return-path security tests pass (5/5); Control Plane regression plus return-path tests pass (7/7); ESLint/Prettier on changed files and Next.js 15.5.25 production build pass.
- **Gate effect:** removes navigation churn only. `INT-5D7A2B1143C8` remains unconfirmed, and Blueprint/routing/ADR-007 plus Real Linear Human Gates remain unchanged.

## 2026-09-10 — Linear live-search defect fix + E2E dispatch harness

**Deprecated-endpoint defect (verified live, read-only):** the live Linear client used
`issueSearch(query:)` for correlation-id lookup. The Linear GraphQL API now rejects that
field — `{"errors":[{"message":"deprecated", "path":["issueSearch"], "code":"INPUT_ERROR",
"statusCode":400}]}`. The dispatcher catches any search error and fails closed, so **every
real dispatch would have been BLOCKED before create**. The read-only preflight never
exercised search (it only queries `viewer` + `team(id:)`), which is why the earlier
Owner-local `ok=true` preflight did not surface this.

- **Fix:** `apps/web/src/lib/linear/client.ts` now calls the current full-text entry point
  `searchIssues(term:, first: 25)` and keeps the exact `correlation_id=` marker match on
  `description`/`title`. No mutation path changed; idempotency semantics are unchanged.
- **Regression cover:** `client.test.ts` asserts the search query uses `searchIssues(term:` and
  never `issueSearch`, and still resolves the exact marker past fuzzy hits;
  `control-plane-e2e.test.ts` transport mock updated to the `searchIssues` shape.
- **Read-only re-preflight from the coding environment:** `npm run linear:preflight` →
  `ok=true`, `adapter=live`, `authenticated=true`, team `Nitis Pro : AIPOS` / `NIT` /
  `acee324a-f2d8-416d-96ef-237298e82986`, `write_performed=false`.

**E2E dispatch harness (Owner-runnable, no external write performed here):**
`apps/web/scripts/linear-e2e-dispatch.ts`, wired as `npm run linear:e2e`. It:

1. runs the read-only preflight (viewer + exact team);
2. seeds ONE reversible mission + workstream in a dedicated local store
   (`.data-stage7-e2e/`, gitignored — isolated from Owner mission data and `INT-5D7A2B1143C8`);
   Notion is forced to mock;
3. dispatches exactly one workstream through the live adapter (the single real `issueCreate`);
4. asserts the returned issue id/identifier and that canonical control-plane state reconciled
   `workstream_id -> linear_issue_id` with status `DISPATCHED`;
5. re-runs the dispatch and asserts the same issue is reused (idempotency, no second write);
6. runs an independent `searchIssues` correlation-id readback and asserts it matches;
7. prints an evidence JSON block and never deletes or archives the issue. A fixed idempotency
   key + persistent local store keep re-runs pointed at the same one issue.

**Local verification:** full web suite 124 passed / 7 PostgreSQL-gated skipped; ESLint clean;
Prettier clean on changed files; Next.js 15.5.25 production build passed; AIPOS Doctor
`pass=32 fail=0 critical=0`.

**Gate effect — unchanged blocks.** The live `npm run linear:e2e` run is NOT executed by an
agent. Before the Owner runs it:
- `INT-5D7A2B1143C8` still needs repair + readback (that draft is not what the harness uses,
  but the standing Human Gate covers all Real Linear writes);
- Blueprint/routing review for the one-workstream dispatch is still required;
- **ADR-007 is still `Reserved` — the full decision text is unapproved.** No Real Linear write
  is authorized until that checkbox is ticked.

The harness only makes the gated action a single reproducible command; it does not lift the gate.
