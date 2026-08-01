# IntakeMissionBundle Schema v1.0

Machine-readable: `packages/schemas/intake-mission-bundle.schema.json`

## Purpose

Logical contract produced by Intake before Mapping. No Subtask IDs, no specialist assignment, no execution.

## Required fields (MVP)

| Field | Type | Notes |
|---|---|---|
| intake_id | string | `INT-...` |
| intake_version | string | `1.0` |
| requester_id | string | Mission owner |
| source | string | MVP: `web_app` (ChatGPT later) |
| source_message_ref | string | Trace to origin message/form |
| raw_request | string | Immutable after create |
| mission_summary | string | Required before awaiting_confirmation |
| desired_outcome | string | Required before ready |
| success_criteria | string[] | ≥1 before ready |
| constraints | string[] | |
| assumptions | object[] | `{id,text,critical,source}` |
| missing_blockers | object[] | Must be empty (resolved) before ready |
| draft_workstreams | object[] | Draft Work Map; WS ids only |
| capability_families | string[] | Families, not specialist bind |
| operational_risk | enum | L0–L4 |
| sensitivity_flags | string[] | |
| sensitivity_acknowledged | boolean | Required true if flags non-empty at confirm |
| approval_requirements | object[] | Anticipated; not all Records |
| knowledge_refs | object[] | |
| attachments | object[] | refs only |
| data_destinations | object[] | See destination model |
| data_handling_requirements | string[] | |
| deadline | string\|null | ISO datetime |
| readiness_status | enum | needs_input \| awaiting_confirmation \| ready_to_dispatch |
| confirmed_by_user | boolean | |
| idempotency_key | string | Duplicate prevention |
| created_at / updated_at | string | ISO datetime |

## Destination object

```json
{
  "system": "intake_channel",
  "trust_class": "approved_private",
  "purpose": "chat_only",
  "persistence": "conversation_only",
  "external_transfer": false
}
```

Forbidden: `system: "none"`.

## Intake stages

1 Capture → 2 Classify → 3 Retrieve context RO → 4 Understand → 5 Blockers → 6 Risk → 7 Sensitivity → 8 Draft Work Map → 9 Bundle → 10 Present → 11 Confirm → 12 ready_to_dispatch → 13 Map to Mission

## Forbidden in Intake

Create Subtask IDs; assign specialists; invoke agents; deploy; publish; send email; modify external systems other than approved Mission Registry write after mapping; bypass confirmation.
