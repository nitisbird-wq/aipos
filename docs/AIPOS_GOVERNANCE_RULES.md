# AIPOS Governance Rules (MVP)

## Dual axes

### Operational risk

| Level | Meaning |
|---|---|
| L0 | Read, analyze, or draft with no external system impact |
| L1 | Create or revise reversible drafts |
| L2 | Write internal data without publishing or external transmission |
| L3 | Send, publish, deploy, merge, schedule, or modify live information |
| L4 | High-impact legal, financial, safety, access-control, or critical-system action |

### Sensitivity flags

`personal_data`, `police_case_data`, `legal_privileged`, `financial`, `credentials`, `health`, `minors`, `internal_confidential`, `public_reputation`, `production_system`

Sensitivity ≠ automatic Authority Approval. Every flag must pass **Handling Gate**.

## Three gates

| Gate | Meaning |
|---|---|
| Acknowledgment | User acknowledges sensitive data when flags present |
| Handling Control | Limits how data is read, stored, sent, processed |
| Authority Approval | Human authority for consequential actions |

## Approval formula

```text
Operational Risk
+ Sensitivity Severity
+ Action Type
+ Data Destination Trust
+ Reversibility
+ Data Exposure
```

## Hard rules (must enforce in code)

1. Intake presents understanding before dispatch readiness.
2. No real Subtask IDs before user confirmation.
3. Unknown capability escalates; never guessed (seed registry only in MVP).
4. Review ≠ Approval (document; execution later).
5. Sensitive data must pass Handling Gate.
6. External transmission / publish / send / deploy / merge / live modify require Authority Gate.
7. Knowledge-capture failure must not silently mark Mission `done` (future closeout; documented now).
8. Every state transition records actor, timestamp, reason, correlation ID.
9. Failed Specialist must not auto-destroy Mission (future; policy encoded).
10. Mission status never edited directly — transition commands only.
11. Chat-only still names `intake_channel` as real destination (never `system: "none"`).
12. Claims must distinguish: session-only vs ChatGPT memory vs external system update.
13. Never claim external update succeeded without verified result.

## Policy Registry

Do not hard-code all rules in UI. Load versioned policies from DB/file.

Minimum fields: `policy_id`, `version`, `name`, `rule_key`, `description`, `severity`, `enabled`, `action_on_violation`, `effective_from`, `change_reason`, `change_log`.

Seed file: `data/seeds/policies.json`.
