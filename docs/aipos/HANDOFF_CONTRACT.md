# AIPOS Handoff Contract (`handoff.v1`)

This contract defines canonical continuity payloads used between ChatGPT branches, Claude sessions, Cursor agents, n8n executions, Linear, Notion, and GitHub.

## Purpose

- Preserve mission continuity without requiring full chat replay.
- Keep canonical runtime state in existing systems (no duplicate state database).
- Enforce evidence-aware, reversible handoff semantics aligned with D4 and the Architecture Contract.

## Required fields

Every handoff record includes:

- `received_context`
- `completed_work`
- `changes_made`
- `verification`
- `remaining_work`
- `failures`
- `decisions`
- `assumptions`
- `evidence_refs`
- `artifacts`
- `next_action`
- `human_action_required`
- `risk_notes`
- `updated_at`
- `updated_by`

## SoT boundaries

- Git/GitHub: code contracts, ADRs, tests, release artifacts.
- Notion: mission/business/knowledge projection.
- Linear: operational work status.
- n8n: execution truth.
- App DB: runtime transactions and synchronization state.

The handoff payload is an orchestration view across these systems. It is not a replacement for their underlying source-of-truth ownership.

## Mission-state alignment

`handoff.v1` includes mission lifecycle state:

- Core: `CAPTURED`, `UNDERSTOOD`, `STRATEGIZED`, `PLANNED`, `APPROVED`, `DISPATCHED`, `EXECUTING`, `VERIFYING`, `INTEGRATING`, `COMPLETED`
- Exceptional: `BLOCKED`, `FAILED`, `RECONCILING`, `WAITING_HUMAN`, `CANCELLED`

## Contract file references

- Runtime schema: `apps/web/src/lib/schemas/contracts.ts`
- Package schema: `packages/schemas/handoff.v1.schema.json`
