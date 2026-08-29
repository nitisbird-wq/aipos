# AIPOS PR #21 — Stage 0 Verification Gate

- **Verification ID:** AIPOS-PR21-STAGE0
- **Date:** 2026-08-29
- **Head verified:** `9d2c630798e76a5305b30e7f830904012e0275b6`
- **PR:** #21 — `cursor/master-continuity-strategy-169c`
- **Status:** NOT READY — contract gaps remain
- **Scope:** Read-first verification only. Phase 1–2 production baseline remains frozen.

## Evidence

- GitHub Actions CI run #51 completed successfully.
- Secret scan: PASS.
- Verify job: PASS for install, test DB migration, format, lint, unit tests, build, AIPOS Doctor, critical dependency audit, and advisory high dependency report.
- PR remains Draft/Open and mergeable.
- Changed-file inventory contains additive app/control-plane/contracts/docs files and no n8n Phase 1–2 workflow export or frozen production record.
- Current PR head adds AIPOS-STD-003 as an approved requirement; it does not claim the follow-up runtime stages are shipped.

## State mapping

The orchestration vocabulary remains canonical for runtime continuity. The Owner dialogue vocabulary is an additive presentation/control layer.

| Owner dialogue state | Existing orchestration state | Meaning / constraint |
|---|---|---|
| RECEIVED | CAPTURED | Intake received; no dispatch |
| DISCOVERING | UNDERSTOOD | Missing context is being discovered |
| IDEATING | UNDERSTOOD / STRATEGIZED | Options are explored; no approval implied |
| OUTCOME_DEFINED | STRATEGIZED | Outcome and Definition of Done exist |
| BLUEPRINT_REVIEW | PLANNED / WAITING_HUMAN | Owner may edit/reject; dispatch forbidden |
| APPROVED | APPROVED | Explicit Blueprint approval recorded |
| DISPATCHED | DISPATCHED | Workstreams mapped to executor system |
| IN_PROGRESS | EXECUTING | Approved work is running |
| HANDOFF | VERIFYING / INTEGRATING | Stage artifact and evidence transfer |
| VERIFYING | VERIFYING | Independent acceptance check |
| COMPLETED | COMPLETED | Definition of Done and required evidence passed |
| WAITING_OWNER | WAITING_HUMAN | Owner action is a real blocker |
| BLOCKED | BLOCKED | Explicit blocker and next action required |
| RECONCILING | RECONCILING | External/runtime state is being repaired |
| FAILED | FAILED | Run failed and recovery decision is required |
| CANCELLED | CANCELLED | Current mission run is terminal |

Semantic locks remain unchanged:

- Intake `ready_to_dispatch` means ready-to-map, not specialist dispatch.
- Mission `ready` means ready-for-planning.
- Dialogue state mapping must not write frozen Phase 1–2 states or reinterpret their production evidence.

## Stage 0 acceptance cases

| ID | Acceptance case | Current evidence | Result |
|---|---|---|---|
| S0-01 | Frozen Phase 1–2 baseline unchanged | PR changed-file inventory; no frozen workflow artifact changed | PASS |
| S0-02 | Blueprint approval exists before dispatch | `runControlPlanePipeline()` builds strategy and dispatches immediately after confirmed Mission; no explicit Blueprint approval input/event | FAIL |
| S0-03 | Unverified capability fails closed | `routeCapabilities()` returns HUMAN/UNMET for missing operators, but pipeline discards the routing decision and continues dispatch | FAIL |
| S0-04 | Primary Mission survives interruption | No primary mission anchor, interruption stack, checkpoint/return event, or resume test exists | UNSUPPORTED |
| S0-05 | Evidence-based completion language | Evidence and verifier contracts exist; Owner-visible completion/progress contract is not implemented | PARTIAL |
| S0-06 | Handoff supports stage continuity | `handoff.v1` preserves mission/workstream/run, completed/remaining work, artifacts, evidence, blockers and next action | PASS |
| S0-07 | Follow-up requirements are not falsely marked shipped | AIPOS-STD-003 and Issue #22 label them implementation pending | PASS |

## Unsupported requirements at this head

The following are requirements, not shipped runtime capabilities:

- editable Mission Blueprint, revision history, explicit Blueprint approval event and stage map;
- capability evidence state, expiry/retest/downgrade and best-fit scoring;
- immutable stage artifact lineage, render verification and Owner compare/download/rollback UI;
- Policy Inbox, provenance ingestion coverage and canonical promotion;
- Primary Mission Anchor, interruption stack, idempotent resume and stale mission supervision;
- Scope Guard, WIP limit, forecast and material scope-change re-approval;
- real Linear E2E, real worker execution, n8n integration, Full Mission E2E and Production Gate.

## Required fixes before PR Ready

1. Add an explicit Blueprint approval gate before `dispatchWorkstreams()`.
2. Carry capability routing result into the pipeline and block dispatch unless an eligible, verified route or explicit HUMAN path exists.
3. Add executable acceptance tests for S0-02 and S0-03.
4. Keep S0-04 as an explicit unsupported Stage 5 requirement unless a bounded continuity contract/test is implemented without claiming the full runtime.
5. Update PR test evidence after CI on the corrective commit.

## Next executable action

Implement the Blueprint approval and capability fail-closed gates on the PR branch, add tests, and require terminal CI evidence. Do not merge or deploy.
