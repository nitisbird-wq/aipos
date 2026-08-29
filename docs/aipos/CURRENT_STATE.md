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
- Stage 3 Stage Artifact Pipeline is the next executable implementation stage.
- Stages 3–7 remain implementation pending. Real Linear, workers, n8n and production execution are not enabled by Stage 1–2 work.
