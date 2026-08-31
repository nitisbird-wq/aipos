# ADR-007 — AIPOS Capability Orchestration

- **Status:** Reserved (awaiting Human Architecture Approval of full decision text)  
- **Date:** 2026-08-31  
- **Deciders:** Mission owner (Human)  
- **Supersedes:** none  
- **Does not replace:** [ADR-006 — AIPOS Control Tower (Governance Enforcement)](./ADR-006-AIPOS-CONTROL-TOWER.md)  
- **Related:** ADR-005 (Phase 3a Planning/Assignment); ADR-006 (Control Tower); Architecture Contract; Phase 1 Decisions (D1, D2, D4); n8n draft prototype `AIPOS — P3 Decompose + Route v0.1` (`xizHBNDiy9W4RLM4`, unpublished)

---

## Purpose of this reservation

Owner decision (2026-08-31): keep **ADR-006** exclusively as Control Tower / Governance Enforcement. Capability Orchestration / Mission Decompose + Route is tracked under **this ADR number (007)**.

Do **not** silently rewrite or rename ADR-006.

---

## Intended decision scope (to be completed with Owner)

This ADR will govern (when approved):

1. Mission Decomposer behavior and acceptance criteria  
2. Capability routing / operator selection policy  
3. Autonomy classes (auto / human / fail-closed) aligned with risk and authority  
4. Relationship to Control Plane services in `apps/web` vs n8n execution adapters  
5. Phase 3 routing gates: routing only after Mission Decomposer is approved  

Out of scope for this reservation stub:

- Publishing or modifying production Mission Intake n8n (`7fLPHiiyt7sre5RR`)  
- Expanding or implementing Phase 3 router/dispatcher in this docs pass  
- Changing Notion Mission/Project Registry databases  

---

## Existing prototype (read-only reference)

| Item | Value |
|---|---|
| Name | AIPOS — P3 Decompose + Route v0.1 |
| n8n workflow ID | `xizHBNDiy9W4RLM4` |
| Active | **false** (unpublished draft) |
| Notes | Heuristic decompose + route; separate from frozen intake; cites ADR-006 historically — future revisions must cite **ADR-007** |

---

## Operational SoT pointer

Production Phase 1–2 status (do not duplicate as a second CURRENT STATE doc):

- Notion: [AIPOS CURRENT STATE](https://app.notion.com/p/3cdbc165be4c81c48e73e5899ae5f0e3)

---

## Approval

| Role | Decision | Date |
|---|---|---|
| Mission owner (Human) | Number reserved; full decision text ☐ Approve / ☐ Approve with corrections / ☐ Reject | 2026-08-31 (number reserved) |
