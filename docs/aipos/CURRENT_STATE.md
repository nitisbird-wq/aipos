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

- Mission strategist: `apps/web/src/lib/services/mission-strategist.ts`
- Playbook engine: `apps/web/src/lib/services/playbook-engine.ts`
- Decomposer (outcome-driven): `apps/web/src/lib/services/decomposer.ts`
- Authority evaluator: `apps/web/src/lib/services/authority.ts`
- Capability router extension: `apps/web/src/lib/services/capability-router.ts`

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
