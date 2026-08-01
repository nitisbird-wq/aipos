# Mission Object Schema v1.0

Machine-readable: `packages/schemas/mission-object.schema.json`

## Creation

Created only after Mapping Gate passes on a confirmed IntakeMissionBundle.

Initial values:

```json
{
  "mission_id": "MIS-...",
  "object_version": "1.0",
  "revision": 1,
  "source_intake_id": "INT-...",
  "source_intake_version": "1.0",
  "mapping_version": "1.0",
  "status": "ready",
  "planning_status": "not_started",
  "planning_revision": 0,
  "last_planned_at": null,
  "planning_reason": null,
  "criticality": "normal",
  "subtask_ids": [],
  "current_blockers": [],
  "approval_policy_refs": [],
  "anticipated_approval_points": [],
  "evidence_refs": []
}
```

## Dual status

| Field | Meaning |
|---|---|
| status | Mission lifecycle (SM) |
| planning_status | Planning round: not_started \| in_progress \| blocked \| completed \| replanning \| failed |

MVP does not run planning to completion; fields exist for forward compatibility.

## Mapping groups

1. **Direct:** summary, outcome, criteria, constraints, deadline, risk, sensitivity, knowledge refs  
2. **Transformed:** destinations, handling, approval policies/triggers, planning_input (draft workstreams)  
3. **Evidence:** raw_request, assumptions, confirmation, intake ids/versions, idempotency — not primary execution control  

## Forbidden on Mission Object

`assigned_specialist`, `provider_model`, `retry_count`, execution runtime fields.

## Mapping Gate (must all pass)

```text
readiness_status = ready_to_dispatch
confirmed_by_user = true
missing_blockers = []
desired_outcome present
≥1 success criterion
operational_risk present
data destinations evaluated
handling gate passed
```

Reject codes: `INTAKE_NOT_CONFIRMED`, `MISSING_SUCCESS_CRITERIA`, `UNRESOLVED_BLOCKER`, `DATA_DESTINATION_NOT_APPROVED`, `HANDLING_GATE_FAILED`, `DUPLICATE_INTAKE`
