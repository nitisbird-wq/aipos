# AIPOS Control Tower v1 — Policy Model

| Field | Value |
|---|---|
| **Document** | `CONTROL_TOWER_POLICY_MODEL` |
| **Version** | `1.0.0` |
| **Status** | `Draft — awaiting Human Architecture Approval` |
| **Date** | `2026-08-07` |

---

## Decision vocabulary

Every guard returns exactly one of:

| Result | Meaning |
|---|---|
| `ALLOW` | Policy satisfied; proceed |
| `WARN` | Proceed allowed with visible risk; CI does not fail unless policy elevates |
| `BLOCK` | Must not proceed; CI fail when Critical or `--profile pr` blocked rules fire |
| `HUMAN_APPROVAL_REQUIRED` | Automation/agent must stop; Human decides |
| `NOT_APPLICABLE` | Guard domain not relevant to this action (neutral; does not lower score as failure) |

---

## Severity

| Severity | Typical use |
|---|---|
| `critical` | Architecture ownership, SSOT blur, secret exposure, invalid high-impact state jump, missing hard dependency |
| `high` | Scope escape, destructive migration without ADR/approval, AI self-merge |
| `medium` | Stale branch, incomplete evidence, degraded health |
| `low` | Advisory hygiene |

Critical **BLOCK** ⇒ overall **BLOCKED** regardless of score band.

---

## Authoritative ownership (must not blur)

| Store | SSOT for |
|---|---|
| **GitHub / this repo** | Code, schemas, ADR (markdown), architecture docs, CI, release artifacts |
| **PostgreSQL App DB** | Runtime transactions: intakes, missions, audit, sync status, execution jobs |
| **Notion** | Operator knowledge / Mission Registry (human ops) — **projection from App**, not runtime DB |
| **User** | Final authority on human-required gates |
| **AIPOS Core** | Decision/control authority (gates, transitions, evidence) |
| **n8n** | Execution adapter only — never Mission decision authority |
| **AI** | Analyze / draft / propose / summarize — **never** approve human-required decisions |

---

## Transition audit policy (Core — enforced by StateGuard / Evidence)

Every allowed state transition must record:

- `actor`
- `timestamp`
- `reason`
- `correlation_id`
- `causation_id`
- `idempotency_key` when relevant
- `policy_result`
- `previous_state`
- `new_state`
- audit event append

**No direct status PATCH.**

---

## Agent action policy

Before high-impact agent actions, Control Tower **must** run (ADR-006).

Agent action context should include:

- `mission_id`
- `requirement_id`
- `scope` (allowed / excluded paths)
- `reason`
- `correlation_id`
- `authority`
- `risk`
- `human_gate` (required / satisfied / not_required)

**BLOCK** examples:

- Agent expands scope itself
- Agent changes locked Phase 1 decision / approved ADR without new ADR + Human
- Agent merges high-impact PR itself
- Agent bypasses human approval
- Agent claims Verified without readback evidence

---

## Dependency policy

Do **not** trust PR “MERGED” label alone.

Required checks:

1. `gh pr view` for state / mergeCommit / base / head  
2. `git merge-base --is-ancestor <merge_commit|head> origin/main` (or documented target)  
3. Schema / migration / ADR dependency declarations in phase or mission config  

Example (repository reality at CT-1):

- PR #10 MERGED into non-`main` base → **not** satisfied as `main` dependency until ancestor check passes (see PR #12 path).

---

## Integration policy (summary)

| System | Direction | Authority | `runtime_ssot` | Write |
|---|---|---|---|---|
| postgres | bidirectional (app↔db) | runtime store | **true** | yes (app) |
| notion | **outbound** | projection | **false** | projection only + verification metadata |
| n8n | app→adapter→callback | **execution_adapter** | **false** | execution only when phase allows |
| github | tool→api | code SSOT tooling | false (code SSOT is git contents) | via PR process |
| openai / AI | app→provider | analyze/draft | false | no mission authority |
| docker | local tooling | environment | false | n/a |
| cursor | agent environment | code assistant | false | via PR; no auto-merge |
| bruno | API collections | test tooling | false | n/a |

Full matrix: [CONTROL_TOWER_GUARD_MATRIX.md](./CONTROL_TOWER_GUARD_MATRIX.md) + Connection Registry (CT-2 `config/control-tower/connections.json`).

---

## Cost / usage policy

CostGuard records (optional telemetry in CT-2):

`provider`, `model`, `operation`, `input_tokens`, `output_tokens`, `estimated_cost`, `latency_ms`, `success`, `retry_count`, `correlation_id`

Default: configuration existence checks only for AI providers; **never** log API keys.

---

## CI policy

| Outcome | CI (`--profile pr`) |
|---|---|
| Critical BLOCK | fail |
| Non-critical BLOCK (if any) | fail when rule marks `ci_fail: true` |
| WARN | visible; do not fail unless elevated |
| TOOL/ENVIRONMENT ERROR | exit 3; treat as fail in CI |

Do not weaken existing Secret scan / Verify jobs.

---

## Policy change control

- Changing Critical guard semantics or SSOT ownership requires **ADR** (amend ADR-006 or new ADR) + Human approval  
- Phase allow/block lists may evolve in `phases.json` (CT-2) without Architecture Contract edit if they only restate approved Phase docs  
- Silent Architecture Contract edits are **forbidden**
