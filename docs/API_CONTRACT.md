# API Contract — Intake MVP v0.1

Base: `/api`  
Auth: session required for mutating routes  
Idempotency: `Idempotency-Key` header on create/confirm (and recommended on retry)  
Correlation: `X-Correlation-Id` on transitions  
**Architecture contract:** [AIPOS_ARCHITECTURE_CONTRACT.md](./AIPOS_ARCHITECTURE_CONTRACT.md)

## Intakes

| Method | Path | Purpose |
|---|---|---|
| POST | `/intakes` | Capture raw request → create intake |
| GET | `/intakes/{id}` | Fetch bundle |
| POST | `/intakes/{id}/analyze` | Run analysis → awaiting_confirmation or needs_input |
| PATCH | `/intakes/{id}` | Correct understanding fields only |
| POST | `/intakes/{id}/confirm` | Confirm → Mapping Gate → Mission + Notion **projection attempt** |
| POST | `/intakes/{id}/cancel` | Cancel intake |

Chat-first aliases may wrap the same services (`/api/chat`, `/api/chat/confirm`) but MUST enforce the same gates and idempotency rules.

## Mission navigation

| Method | Path | Purpose |
|---|---|---|
| GET | `/mission-navigation?workspace_id={id}` | Persistent primary/active mission, resume checkpoint, interruption stack, and stale status |
| POST | `/mission-navigation` | SET_PRIMARY, CHECKPOINT, INTERRUPT, or RESOLVE_INTERRUPTION command |

## Missions

| Method | Path | Purpose |
|---|---|---|
| GET | `/missions` | Dashboard list |
| GET | `/missions/{id}` | Detail |
| POST | `/missions/{id}/transitions` | Allowed transition commands only |
| GET | `/missions/{id}/audit` | Audit events (append-only) |
| POST | `/missions/{id}/notion/retry` | Retry Notion sync when `sync_status=failed` |
| GET | `/missions/{id}/blueprint` | Latest Blueprint and immutable revision history |
| POST | `/missions/{id}/blueprint` | Save a new editable Blueprint revision |
| POST | `/missions/{id}/blueprint/approve` | Approve the latest Blueprint revision |
| GET | `/missions/{id}/scope` | List classified scope/idea ledger |
| POST | `/missions/{id}/scope` | Classify and gate a scope item under WIP policy |
| POST | `/missions/{id}/scope/{scopeId}/approve` | Approve a material change with explicit trade-off |
| POST | `/missions/{id}/forecast` | Calculate stage/mission effort range with assumptions |
| GET | `/missions/{id}/stages/{stageId}/artifacts` | List immutable artifact revisions; optional `left`/`right` comparison |
| POST | `/missions/{id}/stages/{stageId}/artifacts` | Save DRAFT or QA-verified FINAL snapshot |
| POST | `/missions/{id}/stages/{stageId}/artifacts/rollback` | Create a rollback revision without mutating history |
| POST | `/missions/{id}/stages/{stageId}/artifacts/accept` | Accept latest final artifact and emit the next canonical handoff |
| GET | `/missions/{id}/control-plane` | Control Plane snapshot: state, health, supervisor assessment |
| POST | `/missions/{id}/control-plane` | Run Control Plane v1 pipeline (Supervisor → dispatch → verify → integrate) |

### Control Plane

**GET** `/missions/{id}/control-plane`

```json
{
  "ok": true,
  "state": { "schema_version": "control-plane-state.v1", "mission_id": "MIS-...", "..." : "..." },
  "health": { "status": "HEALTHY", "..." : "..." },
  "supervisor": { "next_action": "...", "responsible": "...", "..." : "..." }
}
```

**POST** `/missions/{id}/control-plane`

Request body:

```json
{ "simulate_worker_pass": true }
```

- A persisted `mission_blueprint:approved` event for the latest revision is required. Mission confirmation or a request-body assertion is not Blueprint approval and cannot dispatch.
- Default `simulate_worker_pass=true` runs the pipeline with simulated worker handoff success (no external worker).
- Set `simulate_worker_pass=false` to require real worker handoff evidence (pipeline may stall at verification).

Response includes the approved `blueprint`, `supervisor`, `routing`, `dispatch`, `assignments`, `verifications`, `integration`, `health`, `human_gate`, and `state`.

Errors:

| Code | When |
|---|---|
| `MISSION_NOT_FOUND` | Unknown mission id |
| `BLUEPRINT_APPROVAL_REQUIRED` | Explicit Blueprint approval was not supplied |
| `CAPABILITY_ROUTE_REQUIRED` | No verified/routable capability path exists; dispatch fails closed |
| `LINEAR_LIVE_MISCONFIGURED` | `LINEAR_ADAPTER=live` without `LINEAR_API_KEY` / `LINEAR_TEAM_ID` |

Linear dispatch uses `LINEAR_ADAPTER=mock` by default (no external writes). Live dispatch requires explicit env configuration.

## Forbidden

```text
PATCH /missions/{id}/status
```

## Catalog

| Method | Path |
|---|---|
| GET | `/policies` |
| GET | `/capabilities` |
| GET | `/policy-inbox` | Policy candidates plus connected-channel coverage/gaps |
| POST | `/policy-inbox` | Capture a provenance-bearing policy candidate idempotently |
| POST | `/policy-inbox/{id}/review` | Resolve candidate to ready/rejected/superseded review state |
| POST | `/policy-inbox/{id}/promote` | Record explicit approval against an existing canonical policy ID |
| GET | `/capabilities/registry` | Living capability truth with evidence and effective expiry status |
| POST | `/capabilities/registry` | Save an immutable capability truth revision |
| POST | `/capabilities/registry/{id}/retest` | Record PASS/PARTIAL/FAIL retest evidence and downgrade when needed |

## Idempotency (required behavior)

| Operation | Rule |
|---|---|
| Create intake | Same `Idempotency-Key` → same intake |
| Confirm + map | Same confirmed intake version → same `mission_id` |
| Notion sync/retry | Same `mission_id` + existing `notion_page_id` → update, not duplicate page |

## Confirm response shapes

Success (Notion verified or mock labeled):

```json
{
  "ok": true,
  "mission_id": "MIS-...",
  "status": "ready",
  "notion": { "sync_status": "synced", "notion_page_id": "..." }
}
```

`status=ready` means **ready_for_planning** (not execution/dispatch).

Notion failed but mission created (required):

```json
{
  "ok": true,
  "mission_id": "MIS-...",
  "status": "ready",
  "notion": { "sync_status": "failed", "error": "..." }
}
```

Mapping rejected:

```json
{
  "ok": false,
  "error": { "code": "UNRESOLVED_BLOCKER", "message": "..." }
}
```

Codes: `INTAKE_NOT_CONFIRMED`, `MISSING_SUCCESS_CRITERIA`, `UNRESOLVED_BLOCKER`, `DATA_DESTINATION_NOT_APPROVED`, `HANDLING_GATE_FAILED`, `DUPLICATE_INTAKE`

## Three-State honesty in responses

- Do not report Notion success unless `sync_status=synced` and `notion_page_id` present.  
- `mock_synced` MUST be distinguishable in UI/API from verified sync.
