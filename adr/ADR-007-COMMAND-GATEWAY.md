# ADR-007 — AIPOS Command Gateway

- **Status:** Proposed (design only — **not implemented**)  
- **Date:** 2026-08-12  
- **Deciders:** Mission owner (Human) — pending acceptance  
- **Supersedes:** none  
- **Related:** [COMMAND_GATEWAY_DESIGN.md](../docs/COMMAND_GATEWAY_DESIGN.md); [ADR-006](./ADR-006-CAPABILITY-ORCHESTRATION.md); [ADR-005](./ADR-005-PLANNING-SUBTASK-ASSIGNMENT.md) (present, Proposed); frozen Intake `7fLPHiiyt7sre5RR` / `760150d8-2e1a-4a5e-93a9-48781c306583`; [PRODUCTION_SOURCE_OF_TRUTH.md](../docs/PRODUCTION_SOURCE_OF_TRUTH.md)

---

## Context

The Owner wants a **single command entry** that can reach n8n orchestration, Linear ops, Notion mission/knowledge, and interchangeable operators (Claude / Cursor / OpenAI / later ChatGPT Actions or MCP) without forking Mission Intake or blurring SoT.

Phase 1–2 Mission Intake Pilot is **PRODUCTION PASS / FROZEN**. Phase 3 Capability Orchestration (ADR-006) holds Router/Dispatcher until the Decomposer contract is accepted. Without a Gateway boundary ADR, channels and agents will invent parallel intake and approval paths.

---

## Decision

### D-007.1 — Gateway is front-door only

Introduce module **AIPOS — Command Gateway** as a separate n8n (and later App/MCP) module that:

1. Normalizes owner commands  
2. Classifies `route_class`  
3. Enforces approval state on every command  
4. Routes to existing subsystems  
5. Emits audit with mandatory `correlation_id`  
6. Returns concise owner status  

Gateway is **not** Mission Registry, not workstream SSOT, not a second Intake.

### D-007.2 — No duplicate Mission Intake

`route_class=mission_intake` **MUST** forward to frozen workflow `7fLPHiiyt7sre5RR` (active version `760150d8-…`). Gateway SHALL NOT create Notion Mission pages or Linear parent issues itself.

### D-007.3 — SoT roles unchanged

| Store | SSOT |
|---|---|
| Linear | Operational tasks / workstreams |
| Notion | Mission / business / knowledge registry |
| n8n | Orchestration / adapters |
| App DB | Runtime transactions when enabled |
| Git repo | Code, schemas, ADRs |

### D-007.4 — Operators interchangeable

Claude, Cursor, ChatGPT/OpenAI, n8n automation, Notion, Human are **adapters**. Gateway policy uses capabilities + risk — not hardcoded brand preference as authority.

### D-007.5 — Approval on every consequential action

Every command carries `approval.state`. Consequential execute paths follow ADR-006 D-006.4. Phase 1 CONFIRM remains the only **Mission** approval. No mandatory second mission plan gate.

### D-007.6 — Future channels share one schema

ChatGPT Actions and MCP App are **channels** into the same `GatewayCommand` schema. They MUST NOT bypass Gateway policy.

### D-007.7 — Secrets never exposed

Gateway responses and audits MUST redact credentials and env secrets.

### D-007.8 — Freeze preserved

Gateway implementation MUST be a **new** workflow/module. Editing the frozen 31-node Intake for Gateway features is forbidden.

### D-007.9 — Build order

Design → (accept) → Gateway classify/audit/status + mission forward → Decomposer acceptance → Router/Dispatcher → operator_dispatch via Gateway. Do not publish inactive heuristic `xizHBNDiy9W4RLM4` as Gateway.

---

## Consequences

### Positive

- One Owner command surface without duplicating Intake  
- Clear channel roadmap (Actions/MCP) without logic forks  
- Aligns with ADR-006 risk autonomy and SoT boundaries  

### Negative / follow-up

- Intent classification errors require fail-safe `unknown`  
- Interim audit may live in n8n/Linear until App DB default  
- Operator dispatch remains blocked until ADR-006 Dispatcher  

### Forbidden without new ADR

- Modifying frozen Intake for Gateway features  
- Notion as workstream runtime SSOT  
- Operators self-approving consequential actions  
- Publishing non-compliant P3 heuristic as Gateway  

---

## Compliance checklist

- [x] Design doc authored (`docs/COMMAND_GATEWAY_DESIGN.md`)  
- [x] Draft command schema (`packages/schemas/command-gateway.schema.json`)  
- [ ] Human acceptance of this ADR  
- [ ] Implementation (explicitly **not** started in this change)  
- [ ] n8n Gateway workflow (not created yet)  

---

## References

- Smoke baseline: Execution `37`, Mission `MIS-3`, Linear `NIT-9`  
- Rollback Intake version: `1e655140-03a9-4922-82b8-9689aeba6abb`
