# Stage 7 Live Execution Gate

Date: 2026-08-31  
Scope: PR #21 branch `cursor/master-continuity-strategy-169c`  
Status: **BLOCKED AT HUMAN GATE — API credential required**

## Current state

Stages 0–6 are implemented and verified on the Draft PR branch. CI #143 completed SUCCESS for the final Stage 0–6 documentation head. Stage 7 must begin with a real Linear end-to-end dispatch according to the approved execution order.

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

The remaining Owner action is to create or select a Linear personal API key and place it in the controlled runtime secret store. Do not paste it into chat or commit it.

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
