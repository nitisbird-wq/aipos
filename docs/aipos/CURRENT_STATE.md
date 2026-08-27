# AIPOS vNEXT Current State (Continuity Baseline)

## Scope status

- Frozen production workflow baseline remains unchanged.
- New continuity and strategy contracts are implemented as additive orchestration contracts.
- Dispatcher remains intentionally blocked.

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
