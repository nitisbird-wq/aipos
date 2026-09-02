# AIPOS Command Gateway — Design

**Status:** Design only — **not implemented**  
**Module name:** `AIPOS — Command Gateway`  
**Date:** 2026-08-12  
**ADR:** [ADR-007](../adr/ADR-007-COMMAND-GATEWAY.md) (Proposed)  
**Frozen baseline:** Mission Intake Pilot `7fLPHiiyt7sre5RR` / active version `760150d8-2e1a-4a5e-93a9-48781c306583` — **SHALL NOT modify**  
**Related:** [PRODUCTION_SOURCE_OF_TRUTH](./PRODUCTION_SOURCE_OF_TRUTH.md), [ADR-006](../adr/ADR-006-CAPABILITY-ORCHESTRATION.md), [Architecture Contract](./AIPOS_ARCHITECTURE_CONTRACT.md), [MISSION_DECOMPOSER_CONTRACT](./MISSION_DECOMPOSER_CONTRACT.md)

---

## 1. Purpose

Give the Owner **one command surface** that:

1. Receives an owner command (chat, webhook, later ChatGPT Actions / MCP)  
2. Normalizes intent into a typed `GatewayCommand`  
3. Classifies route class  
4. Hands off to the **correct existing subsystem** (never duplicates Mission Intake)  
5. Enforces Human Gate / approval state for consequential actions  
6. Writes an audit event with `correlation_id`  
7. Returns a concise owner-facing status  

```text
Owner command
  → Gateway (normalize + classify + policy)
    → route to subsystem
      → audit + status response
```

The Gateway is a **router and policy front-door**, not a second Mission Registry, not a second Intake workflow, and not a replacement for Linear/Notion SoT roles.

---

## 2. Architecture

### 2.1 Context diagram

```text
┌─────────────────────────────────────────────────────────────┐
│ Owner channels (interchangeable fronts)                     │
│  Web UI · n8n Chat/Webhook · later ChatGPT Actions · MCP    │
└───────────────────────────┬─────────────────────────────────┘
                            │ GatewayCommand (+ correlation_id)
                            ▼
┌─────────────────────────────────────────────────────────────┐
│ AIPOS — Command Gateway  (NEW module; separate n8n WF)      │
│  1. AuthZ: actor is Owner / delegated operator              │
│  2. Normalize text → intent + entities                      │
│  3. Classify route_class                                    │
│  4. Approval policy (D-006.4 + consequential-action rules)  │
│  5. Emit audit_event                                        │
│  6. Dispatch to subsystem adapter OR return needs_approval  │
│  7. Compose owner_status                                    │
└───────┬─────────┬──────────┬──────────┬──────────┬─────────┘
        │         │          │          │          │
        ▼         ▼          ▼          ▼          ▼
   Frozen     Linear     Notion     Operator    System
   Intake     (ops)      (mission/  adapters    audit /
   7fLPHii…              knowledge) (Claude/    emergency
   (missions)            registry)  Cursor/n8n) stop
```

### 2.2 Non-goals

- Do **not** re-implement Mission Intake CONFIRM / Notion create / Linear parent create  
- Do **not** become workstream SSOT (Linear remains ops truth)  
- Do **not** become mission/business SSOT (Notion remains that truth)  
- Do **not** hardcode a single LLM brand as the only operator  
- Do **not** store or return secrets, tokens, or credential material  
- Do **not** auto-approve L3–L4 / secrets / deploy / merge / irreversible / sensitive external / `domain.*`

### 2.3 Placement vs existing modules

| Module | Role vs Gateway |
|---|---|
| Frozen Intake `7fLPHiiyt7sre5RR` | **Only** path for new mission create + Phase 2 parent Linear dispatch |
| ADR-006 Decomposer / Router / Dispatcher | Downstream of Gateway `operator_dispatch` / post-mission orchestration (**HELD** until Decomposer accepted) |
| ADR-005 App-DB Planning | Parallel long-term Core track; Gateway may later project `correlation_id` — not required for Gateway v0 |
| Inactive P3 draft `xizHBNDiy9W4RLM4` | **Not** the Gateway; do not publish / do not reuse as authority |

---

## 3. Command schema (design)

Draft machine schema: `packages/schemas/command-gateway.schema.json`  
Conceptual type:

```json
{
  "command_id": "cmd_<ulid>",
  "correlation_id": "corr_<ulid>",
  "idempotency_key": "gw:<actor>:<hash-or-client-key>",
  "received_at": "ISO-8601",
  "channel": "n8n_webhook | web | chatgpt_actions | mcp | chat_trigger",
  "actor": {
    "type": "owner | operator | system",
    "id": "owner:primary"
  },
  "raw_text": "optional natural language",
  "intent": {
    "route_class": "mission_intake | status_query | approval_response | operator_dispatch | result_collection | system_audit | emergency_stop | unknown",
    "confidence": 0.0,
    "entities": {
      "mission_id": "MIS-3 | null",
      "linear_issue": "NIT-9 | null",
      "workstream_id": "WS-MIS-3-01 | null",
      "approval_decision": "approve | reject | null",
      "target_operator": "claude | cursor | n8n | notion | human | null"
    }
  },
  "approval": {
    "state": "not_required | pending | approved | rejected | superseded",
    "required": false,
    "reason": null,
    "decided_by": null,
    "decided_at": null,
    "policy_version": "ADR-006.D-006.4+GW-1"
  },
  "route": {
    "subsystem": "frozen_intake | linear_ops | notion_read | operator_adapter | audit_store | kill_switch | none",
    "handoff_ref": null
  },
  "owner_status": {
    "summary": "short string for Owner",
    "next_action": "none | confirm_mission | approve_dispatch | wait | clarify"
  }
}
```

### Hard field rules

| Rule | Requirement |
|---|---|
| R1 | `correlation_id` **mandatory** on every accepted command |
| R2 | `approval.state` **mandatory** on every accepted command (even when `not_required`) |
| R3 | Consequential actions MAY NOT execute while `approval.state=pending` |
| R4 | Responses MUST redact secrets; never echo env tokens / API keys |
| R5 | `idempotency_key` required for mutating routes |
| R6 | `route_class=unknown` → ask clarifying question; do not invent a mission |

---

## 4. Route table

| `route_class` | Meaning | Subsystem | Mutates? | Default approval |
|---|---|---|---|---|
| `mission_intake` | New mission / intake conversation | **Frozen Intake** `7fLPHiiyt7sre5RR` only | Yes (via Intake) | Mission CONFIRM inside Intake (Phase 1) — Gateway does not duplicate |
| `status_query` | Status of Mission / Linear / sync | Notion read + Linear read (+ optional App DB) | No | `not_required` |
| `approval_response` | Owner approves/rejects a pending gate | Gateway approval store → resume held handoff | Yes (policy) | Must reference existing `pending` command / workstream |
| `operator_dispatch` | Dispatch / resume workstream to an operator | ADR-006 Dispatcher (when built); Linear child as ops truth | Yes | Per D-006.4 risk policy |
| `result_collection` | Collect operator/n8n result into audit + Linear/Notion notes | Collector adapters | Yes (writes evidence refs) | Usually `not_required` if write is reversible metadata; Human if external sensitive |
| `system_audit` | Doctor / sync / freeze / capability connectivity report | Read-only diagnostics | No | `not_required` |
| `emergency_stop` | Halt further autonomous dispatch | Kill-switch flag + cancel queued dispatches | Yes | **Always** Owner-authenticated; audit critical |
| `unknown` | Cannot classify safely | none | No | `not_required`; return clarify |

### Routing invariants

1. **New missions → Frozen Intake only.** Gateway may *forward* the owner utterance / structured payload into Intake chat/webhook; it MUST NOT create Notion Mission pages or Linear parents itself.  
2. **Linear = operational task truth** for workstreams / parent mission issues.  
3. **Notion = mission/business/knowledge truth.** Gateway reads Notion for status; writes only via existing verified adapters when policy allows.  
4. **n8n = orchestration layer** hosting Gateway + adapters; not SoT for mission or workstream state.  
5. **Operators (Claude / Cursor / ChatGPT / OpenAI) are interchangeable** behind `target_operator` + capability match — never brand-locked in Gateway policy.  
6. Inactive P3 heuristic `xizHBNDiy9W4RLM4` is **not** a Gateway route target.

### Example Owner utterances → routes

| Utterance | Route |
|---|---|
| “New mission: compare three cafés for SAHAKON promo” | `mission_intake` → Frozen Intake |
| “Status of MIS-3” | `status_query` |
| “Approve dispatch of WS-MIS-3-02” | `approval_response` |
| “Send WS-MIS-3-01 to Cursor” | `operator_dispatch` (after Decomposer/Router exist; else `blocked` with reason) |
| “Collect results for NIT-9 children” | `result_collection` |
| “Run system audit / doctor summary” | `system_audit` |
| “STOP all auto-dispatch” | `emergency_stop` |

---

## 5. Approval policy

Gateway **extends** ADR-006 D-006.4; it does not invent a second Mission approval product.

### 5.1 Mission-level

- Phase 1 CONFIRM inside Frozen Intake remains the **only Mission approval**.  
- Gateway `mission_intake` never adds a parallel “approve mission again” step.

### 5.2 Consequential action matrix (Gateway-enforced)

| Condition | `approval.state` before execute |
|---|---|
| Read-only status / audit | `not_required` |
| L0–L1 reversible operator dispatch (post Phase 2 parent exists) | `not_required` (auto) when credentials verified |
| L2 reversible **and** within delegated authority | `not_required` (auto) |
| L2 otherwise | `pending` → Owner |
| L3–L4 | `pending` → Owner |
| Secrets, production change, merge/deploy, irreversible, sensitive external, `domain.*` | `pending` → Owner |
| Unknown capability / operator / authority | **fail closed** (`blocked`); ask Owner — do not auto-dispatch |
| `emergency_stop` | Owner-authenticated execute; still audited |

### 5.2 Approval object (minimum)

Every command carries:

```text
approval.state ∈ { not_required, pending, approved, rejected, superseded }
approval.required: boolean
approval.reason: string | null
approval.policy_version: string
```

`approval_response` commands must cite `correlation_id` or `command_id` of the pending action.

---

## 6. n8n workflow boundary

### 6.1 New workflow (future build — not now)

| Item | Spec |
|---|---|
| Proposed name | `AIPOS — Command Gateway v0.1` |
| Type | **Separate** workflow from Frozen Intake |
| Trigger | Webhook (+ optional Chat Trigger later) |
| Publish | Only after design acceptance + dry-run |
| Must not | Edit nodes inside `7fLPHiiyt7sre5RR` |

### 6.2 Suggested node groups (design)

```text
[Ingress]
  Webhook / Chat Trigger
  → Normalize Command (Code)
  → Ensure correlation_id + idempotency_key
[Classify]
  → Classify Intent (LLM optional + deterministic guards)
  → Route Switch
[Policy]
  → Approval Policy (D-006.4)
  → IF pending → Respond Needs Approval (stop)
[Dispatch adapters — separate Execute Workflow / HTTP]
  → Forward to Frozen Intake (mission_intake only)
  → Linear status / comment adapters
  → Notion read adapters
  → Operator dispatch (HELD until ADR-006 Dispatcher)
  → Result collector
  → Emergency stop flag store
[Egress]
  → Append Audit
  → Respond Owner Status
```

### 6.3 Handoff to Frozen Intake

For `mission_intake`, Gateway **forwards** to the existing Intake surface (Chat Trigger conversation or a dedicated internal execute entry that Intake already owns). Preferred v0: respond with “continue in Mission Intake” deep-link / hand the same chat session to Intake — **zero duplicate Notion/Linear create logic in Gateway**.

If an internal execute webhook is added later, it must live as a **TEMP harness outside** the frozen 31-node graph (same rule used in Phase 2 testing).

### 6.4 Explicit non-targets

| Workflow | Gateway relation |
|---|---|
| `7fLPHiiyt7sre5RR` | Downstream for missions only; frozen |
| `xizHBNDiy9W4RLM4` | Do not call |

---

## 7. API / MCP / ChatGPT Actions future interface

### 7.1 HTTP (future)

```text
POST /api/gateway/commands
Headers:
  Authorization: session | signed owner token
  Idempotency-Key: ...
  X-Correlation-Id: ...   # optional; Gateway mints if absent
Body: { raw_text?, intent?, entities? }

GET  /api/gateway/commands/{command_id}
POST /api/gateway/commands/{command_id}/approve
POST /api/gateway/commands/{command_id}/reject
```

App routes MUST reuse Architecture Contract audit + idempotency patterns. No secrets in responses.

### 7.2 MCP App (future)

Expose tools as thin wrappers over the same command schema:

| Tool | Maps to `route_class` |
|---|---|
| `aipos_command` | generic entry (preferred single tool) |
| `aipos_mission_status` | `status_query` |
| `aipos_approve` | `approval_response` |
| `aipos_emergency_stop` | `emergency_stop` |

MCP must not bypass approval policy.

### 7.3 ChatGPT Actions (future)

OpenAPI action that POSTs to Gateway webhook. Intake-only Actions (Phase 0.2 note in Phase 1 decisions) remain valid as a **channel**; Gateway is the normalization layer so Actions do not fork business logic.

### 7.4 Operator interchangeability

```text
Gateway → required_capabilities → eligible_operators → adapter
```

ChatGPT / Claude / Cursor / OpenAI are **operator adapters**, not Gateway policy authorities. None may self-approve consequential actions.

---

## 8. Audit trail

Every accepted command appends an audit record (App DB when available; n8n execution + Linear comment / Notion note as interim projection):

| Field | Required |
|---|---|
| `event_id` | yes |
| `command_id` | yes |
| `correlation_id` | yes |
| `actor` | yes |
| `route_class` | yes |
| `approval.state` | yes |
| `subsystem` | yes |
| `previous_state` / `new_state` | when state changes |
| `policy_result` | yes |
| `occurred_at` | yes |
| secret material | **forbidden** |

---

## 9. Owner-facing status (response contract)

Always concise:

```json
{
  "ok": true,
  "correlation_id": "corr_…",
  "route_class": "status_query",
  "approval": { "state": "not_required" },
  "summary": "MIS-3 dispatched to Linear NIT-9; Notion writeback PASS.",
  "next_action": "none",
  "refs": { "mission_id": "MIS-3", "linear_issue": "NIT-9" }
}
```

If blocked:

```json
{
  "ok": false,
  "correlation_id": "corr_…",
  "route_class": "operator_dispatch",
  "approval": { "state": "pending", "reason": "L3 requires Human Approval" },
  "summary": "Dispatch held. Reply: approve WS-MIS-3-02",
  "next_action": "approve_dispatch"
}
```

---

## 10. Minimal implementation plan

### Now (design acceptance — this doc)

1. Human review of this design + ADR-007 Proposed  
2. Keep Decomposer contract as prerequisite for `operator_dispatch` depth  
3. Do **not** implement Gateway workflow yet  
4. Do **not** modify Frozen Intake  

### Build next (v0 — after design accept)

1. New inactive n8n Gateway workflow (classify + audit + status only)  
2. `status_query` + `system_audit` read paths  
3. `mission_intake` forward to Frozen Intake (no duplicate create)  
4. `emergency_stop` flag (boolean store) + audit  
5. Schema + Vitest for command normalize/classify fixtures  

### Later

1. `approval_response` store wired to held dispatches  
2. `operator_dispatch` after ADR-006 Decomposer/Router/Dispatcher  
3. `result_collection`  
4. App `/api/gateway/*`  
5. MCP tools + ChatGPT Actions OpenAPI  
6. Projection into App DB audit when Postgres default lands  

---

## 11. What to build now vs later

| Item | Now | Later |
|---|---|---|
| Design + ADR-007 Proposed | ✅ | |
| Command JSON schema (draft) | ✅ | |
| Frozen Intake changes | ❌ never for Gateway features | defect-only |
| Duplicate Intake | ❌ | |
| Publish Gateway workflow | ❌ | after dry-run |
| Live operator dispatch via Gateway | ❌ | after ADR-006 Dispatcher |
| ChatGPT Actions / MCP | ❌ | channel adapters |
| Full App-DB Gateway API | ❌ | after Core readiness |

---

## 12. Risks

| Risk | Mitigation |
|---|---|
| Gateway becomes second Intake | Hard route: missions → Frozen Intake only; code review checklist |
| Gateway becomes second approval bureaucracy | No mission re-approval; risk-based only (D-006.4) |
| Intent misclassification → wrong mutate | Deterministic guards; `unknown` fail-safe; mutating routes require entities |
| Secret leakage in status text | Redaction layer; forbid env dumps in audit |
| Calling non-compliant P3 draft | Explicit deny-list of `xizHBNDiy9W4RLM4` |
| SoT blur (Notion as ops DB) | Linear ops / Notion mission-knowledge invariant |
| Emergency stop incomplete | Stop flag checked by all future dispatchers before run |

---

## 13. Rollback strategy

| Layer | Rollback |
|---|---|
| Design-only (current) | Revert docs/ADR/schema commit; no runtime impact |
| Unpublished Gateway WF | Leave inactive or archive; Intake unaffected |
| Published Gateway WF | Unpublish Gateway; Owner returns to direct Intake chat; Frozen Intake version unchanged |
| Bad classify logic | Restore prior Gateway **version ID**; workflow ID stable |
| Emergency stop stuck on | Owner `approval_response` / explicit clear-stop command |

Frozen Intake rollback remains independent: version `1e655140-03a9-4922-82b8-9689aeba6abb` (documented in PRODUCTION_SOURCE_OF_TRUTH).

---

## 14. Acceptance checklist (before any build)

- [ ] Owner accepts ADR-007 Proposed (or requests changes)  
- [ ] Route table reviewed against SoT boundaries  
- [ ] Confirmed: no Frozen Intake node edits  
- [ ] Confirmed: Decomposer still ahead of Dispatcher  
- [ ] Schema draft reviewed for correlation_id + approval.state mandates  

---

## 15. References

- Production SoT: `docs/PRODUCTION_SOURCE_OF_TRUTH.md`  
- ADR-006 Capability Orchestration  
- ADR-005 Planning (App-DB; Proposed; non-competing)  
- Architecture Contract §§0–4 (SoT, audit, idempotency)  
- Linear Workstream Contract  
- Mission Decomposer Contract (ADR-006.v2)
