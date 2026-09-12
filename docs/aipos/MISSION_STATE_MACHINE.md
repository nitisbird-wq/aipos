# AIPOS Mission State Machine (Orchestration View)

This model is the canonical orchestration state vocabulary for continuity and handoff.
It does not replace existing Intake/Mission/Sync state machines in the Architecture Contract.

## Mission orchestration states

1. `CAPTURED`
2. `UNDERSTOOD`
3. `STRATEGIZED`
4. `PLANNED`
5. `APPROVED`
6. `DISPATCHED`
7. `EXECUTING`
8. `VERIFYING`
9. `INTEGRATING`
10. `COMPLETED`

Exceptional:

- `BLOCKED`
- `FAILED`
- `RECONCILING`
- `WAITING_HUMAN`
- `CANCELLED`

## Mapping note

Per the Architecture Contract semantic lock:

- Intake `ready_to_dispatch` means ready-to-map, not specialist dispatch.
- Mission `ready` means ready-for-planning.

This state machine is an orchestration continuity model used by handoff and planning logic.
It is intentionally additive and does not modify the frozen production workflow baseline.

## Transition guidance

- Blocking transitions move to `BLOCKED` with explicit reason and risk note.
- Authority uncertainty fails closed and moves to `WAITING_HUMAN`.
- Verification failures move to `RECONCILING` or `FAILED` depending on recoverability.
- Cancellation is terminal for current mission run context.

## Contract file references

- Runtime schema: `apps/web/src/lib/schemas/contracts.ts` (`MissionStateSchema`)
