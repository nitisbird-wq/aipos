# AIPOS vNEXT Current State (Continuity Baseline)

## Scope status

- Frozen production workflow baseline remains unchanged.
- New continuity and strategy contracts are implemented as additive orchestration contracts.
- Control Plane v1 pipeline is implemented (Supervisor → Decompose → Human Gate → Linear dispatch → Worker packages → Verify → Integrate → Health).
- Workstream Dispatcher is implemented with mock Linear default; live Linear dispatch is opt-in via `LINEAR_ADAPTER=live` + credentials.

## Implemented contracts

- `handoff.v1`
- `context-object.v1`
- `mission-context-pack.v1`
- `owner-interaction-contract.v1`
- `mission-strategy.v1`
- `deliverable-contract.v1`
- `evidence.v1`
- `recovery.v1`

## Implemented runtime modules

- Control Plane state core: `apps/web/src/lib/services/control-plane-state.ts`
- AIPOS Supervisor: `apps/web/src/lib/services/aipos-supervisor.ts`
- Health Supervisor: `apps/web/src/lib/services/health-supervisor.ts`
- Workstream Dispatcher (idempotent + repair): `apps/web/src/lib/services/workstream-dispatcher.ts`
- Linear dispatch client (mock default / live opt-in): `apps/web/src/lib/linear/client.ts`
- Operator Contract packager: `apps/web/src/lib/services/operator-contract.ts`
- Verifier + Result Integrator: `apps/web/src/lib/services/verifier-integrator.ts`
- Human Gate policy bridge: `apps/web/src/lib/services/human-gate.ts`
- Evidence promotion guards: `apps/web/src/lib/services/evidence.ts`
- Recovery SBI/GROW planner: `apps/web/src/lib/services/recovery.ts`
- Canonical handoff builder: `apps/web/src/lib/services/handoff.ts`
- Mission strategist: `apps/web/src/lib/services/mission-strategist.ts`
- Playbook engine: `apps/web/src/lib/services/playbook-engine.ts`
- Decomposer (playbook/outcome-driven, rejects generic titles): `apps/web/src/lib/services/decomposer.ts`
- Authority evaluator: `apps/web/src/lib/services/authority.ts`
- Capability router + operator handle: `apps/web/src/lib/services/capability-router.ts`
- Control Plane pipeline orchestrator: `apps/web/src/lib/services/control-plane-pipeline.ts`
- Mission control-plane API: `apps/web/src/app/api/missions/[id]/control-plane/route.ts`
- Runtime reconcile after external actions: `apps/web/src/lib/services/runtime-reconcile.ts`
- Independent Verifier: `apps/web/src/lib/services/verifier.ts`
- Independent Result Integrator: `apps/web/src/lib/services/result-integrator.ts`
- Architecture gap audit: `docs/aipos/ARCHITECTURE_GAP_AUDIT.md`

## Continuity contract behavior

- Handoff payload includes required continuity fields and mission orchestration state.
- Context loading is bounded to relevant context pack entries.
- Missing information uses:
  - `BLOCKER`
  - `SAFE_ASSUMPTION`
  - `DISCOVERABLE`
  - `OPTIONAL_REFINEMENT`
- Only `BLOCKER` is treated as owner interruption.

## Owner friction tracking

Current tracked counters:

- `owner_questions_count`
- `human_gate_count`
- `avoidable_questions_count`

## SoT boundary statement

- Notion remains mission/business/knowledge projection.
- Linear remains operational work status.
- Git/GitHub remain code/contracts/ADR source.
- n8n remains execution truth.
- App DB remains runtime transaction system.

## Health Supervisor states

- `HEALTHY` / `WARNING` / `BLOCKED` / `CRITICAL` with findings + remediation
- Continuous scan: `evaluateAllMissionsHealth()`
- Detects stale missions, failed executions, duplicate workstreams, missing handoffs, orphan Linear mappings, state divergence, stale evidence, waiting-human SLA breaches, completed work without artifacts


## Owner Mission Standard implementation status

- Stage 0 PR verification gate: COMPLETE; evidence in `docs/aipos/PR21_STAGE0_VERIFICATION.md`.
- Stage 1 Mission Blueprint & Stage Map: COMPLETE; evidence in `docs/aipos/STAGE1_BLUEPRINT_VERIFICATION.md`.
  - Implemented `mission-blueprint.v1`, numbered stages, dependencies, entry/exit criteria, critical path, immutable audit-backed revisions, explicit approval event, and evidence-only completion progress.
  - Control-plane dispatch reads the persisted latest approved Blueprint; request-body assertions cannot approve.
  - Owner mission UI shows stage X/Y, progress, remaining path, critical path, evidence, revision history, and one next action.
  - Owner can edit stage contracts, add/remove/reorder stages, save a new revision, and explicitly approve the latest revision.
  - API: GET/POST `/api/missions/{id}/blueprint`; POST `/api/missions/{id}/blueprint/approve`.
  - CI #72, #76, and #77: SUCCESS.
- Stage 2 Capability & Team Intelligence: COMPLETE; evidence in `docs/aipos/STAGE2_CAPABILITY_VERIFICATION.md`.
  - Living `capability-registry.v1` records immutable audit-backed truth revisions.
  - VERIFIED/PARTIAL/UNVERIFIED/UNAVAILABLE/REVERIFY_REQUIRED/DEGRADED states include evidence, expiry, retest, and downgrade behavior.
  - Routing reports requirement coverage and explainable KEEP/ASSIST/HANDOFF/SPLIT/HUMAN_REQUIRED decisions.
  - Control Plane consumes Living Registry truth when populated and fails closed on any uncovered requirement.
  - API: GET/POST `/api/capabilities/registry`; POST `/api/capabilities/registry/{id}/retest`.
  - CI #90: SUCCESS.
- Stage 3 Stage Artifact Pipeline: COMPLETE; evidence in `docs/aipos/STAGE3_ARTIFACT_VERIFICATION.md`.
  - Immutable audit-backed `stage-artifact.v1` snapshots preserve revision/parent/rollback lineage and checksums.
  - Artifact promotion requires editable/final/preview URIs plus artifact-specific QA evidence.
  - Acceptance emits canonical handoff and advances the next action while keeping accepted artifacts accessible.
  - Owner UI supports stage selection, draft/final save, compare, download/preview, rollback, QA evidence, and acceptance.
  - API: stage artifact list/save/compare, rollback, and accept.
  - CI #96 and #104: SUCCESS.
- Stage 4 Policy Intelligence: COMPLETE; evidence in `docs/aipos/STAGE4_POLICY_VERIFICATION.md`.
  - Audit-backed `policy-inbox.v1` captures provenance, scope, priority, confidence, dates, and proposed canonical target.
  - Deterministic source idempotency and fingerprinting identify duplicates; declared conflicts fail closed; supersession remains traceable.
  - Canonical promotion requires separate review and explicit approval events and references the existing canonical policy ID.
  - Coverage reports distinguish connected channels with/without data and unavailable-channel gaps.
  - API: policy inbox list/capture/coverage, review, and promote.
  - CI #116: SUCCESS.
- Stage 5 Persistent Mission Navigation: COMPLETE; evidence in `docs/aipos/STAGE5_NAVIGATION_VERIFICATION.md`.
  - Audit-backed `mission-navigation.v1` persists primary/active mission, objective, Definition of Done, checkpoint, and interruption stack.
  - Checkpoints and resume are idempotent; interruption resolution returns to the preserved checkpoint with one next action.
  - Stale evaluation exposes age/threshold and focused reminder data without mutating state.
  - API: GET/POST `/api/mission-navigation`.
  - CI #127: SUCCESS.
- Stage 6 Scope and WIP Control: COMPLETE; evidence in `docs/aipos/STAGE6_SCOPE_VERIFICATION.md`.
  - Audit-backed `scope-guard.v1` classifies MUST_NOW/SHOULD_NEXT/LATER/REJECT and retains parked ideas.
  - MUST_NOW requires Definition-of-Done or safety evidence; WIP limit enforces finish-before-expand.
  - Material time/cost/risk/architecture change is parked until explicit trade-off approval.
  - Forecast API returns min/max stage and mission ranges with assumptions.
  - CI #138: SUCCESS.
- Stage 7 Live Execution: BLOCKED AT CREDENTIAL HUMAN GATE; evidence in `docs/aipos/STAGE7_LIVE_EXECUTION_GATE.md`.
  - CI #143 completed SUCCESS for the Stage 0–6 final documentation head.
  - A read-only authenticated Linear connection verified team `Nitis Pro : AIPOS` and team ID `acee324a-f2d8-416d-96ef-237298e82986`; no external write occurred.
  - `npm run linear:preflight` verifies the runtime API key and exact team mapping without a mutation or secret output.
  - Remaining human gate: configure `LINEAR_ADAPTER=live` and `LINEAR_API_KEY` in the controlled runtime; use the verified `LINEAR_TEAM_ID`.
  - Next after credential preflight: one reversible idempotent Real Linear E2E test with mapping/reconciliation evidence.
- Real Linear, real workers, Health/Recovery runtime integration, n8n, Full Mission E2E, and Production Gate remain pending and unverified.
