# AIPOS Phase 1 Decisions — Know-Me, Hard Control, Tool Chain

**Status:** Approved for Implementation (captured 2026-08-01)  
**Notion ADR:** [AIPOS-ADR-004](https://app.notion.com/p/3afbc165be4c811bbdd1c8d7101a6013)  
**Parent architecture:** AIPOS-ADR-003 (Nitis Pro OS v3 Unified Architecture)  
**Repo binding:** Extends Mission Intake MVP v0.1 toward orchestration without replacing Intake UI.  
**Enforceable MVP contract:** [AIPOS_ARCHITECTURE_CONTRACT.md](./AIPOS_ARCHITECTURE_CONTRACT.md) (closes Approve-with-Conditions C-01…C-03, H-01…H-05).  
**Governance v1 backlog (deferred):** [GOVERNANCE_V1_BACKLOG.md](./GOVERNANCE_V1_BACKLOG.md) — version compatibility, traceability matrix, decision lifecycle.

## Source-of-truth boundaries

Do not use bare “SSOT” without a data class:

| Store | SSOT for |
|---|---|
| **GitHub / this repo** | Code, JSON/Zod schemas, architecture docs, ADRs in-repo, CI, releases |
| **Notion** | Operator Identity/Role knowledge, Mission Registry (human ops), Digital Brain content |
| **App Database** | Runtime transactions: intakes, missions, audit events, sync status, jobs |

- AIPOS Core orchestrates; Notion is registry/knowledge projection, not the runtime event store.
- Operator Profile: Notion is human SSOT; App DB holds runtime cache after verified sync.

## Governance verification (ADR / Registry)

Notion Governance Asset rows for Phase 1 decisions must eventually record evidence, not only a checkbox:

```yaml
verified: true|false
verified_by: mission-owner|<actor>
verified_at: YYYY-MM-DD
adr: AIPOS-ADR-004
document_version: "1.0"
decision_status: Approved for Implementation|Superseded
```

Until `verified: true` with the fields above, agents treat ADR-004 as **approved for implementation planning** but must not claim Notion governance verification is complete.

## D1 — Tool Chain

| Order | System | Role |
|---|---|---|
| 1 | ChatGPT | Command / intake / review / decision support |
| 2 | Claude | Documents / research / synthesis |
| 3 | Cursor | Code / repository |
| 4 | n8n | Workflow / connector execution |
| 5 | Notion | Digital Brain / Mission Registry (verified write + readback) |

**Rules**

- **AIPOS Core (Next.js in this repo)** is the control plane (gates, evidence, Three-State, mission transitions).
- ChatGPT and Notion are **not** the permanent orchestrator.
- Skip steps when capability does not apply; never skip Notion verified write when claiming external persistence.
- n8n is an adapter, not Mission decision authority.

## D2 — Autonomy

- User confirms the plan **once**.
- System may auto-run matching, assignment, and **L0–L1** execution.
- L3–L4 and high-impact external actions require Authority Approval.

## D3 — Know-Me

**Human SSOT (Notion corpus — same Nitis Pro draft family):**

- Identity OS
- Role OS
- [Command Center v2](https://app.notion.com/p/38ebc165be4c811cb05bd05e2c2791b8) (MCP-resolvable id `38ebc165…`; share id `bf4785fe…` may 404)
- Current Priorities

**Runtime:** sync → `operator_profiles` in App DB → inject into analyze / plan / execute.  
Never invent unconfirmed personal facts, authority, family detail, or case data.

## D4 — Hard Control (anti-hallucination)

Backend contract (not prompt-only):

1. Epistemic labels: `confirmed | reported | inferred | hypothesis | unknown`
2. Three-State: `session_only | app_persisted | external_verified`
3. Evidence objects + mandatory `correlation_id` + handoff records (STD-002)
4. Gates G0–G5 (intake → understanding → handling → authority → external write → verification)
5. Grounded LLM: Zod-constrained output; system status only from adapters; post verifier before `review`
6. Foundation: live Postgres + real Notion readback before full auto-execute

## D5 — Excellence (after Hard first)

- Mission Quality Pack (role, outcome, criteria, DoD, Parking Lot)
- Model tiering, profile cache, budget caps
- Accept/reject feedback → `learned_prefs`
- Closeout: Completed / Current Status / Decision / Next Action
- iPad-first Commander UX

## D6 — Implementation order

1. Docs/schemas (profile, evidence, handoff, epistemic, G0–G5)
2. Postgres live + Notion verified + Three-State API
3. Know-Me sync + inject
4. Gate/verifier + Pilot TC-01…TC-08
5. Planning → confirm-once → L0–L1 execute + artifacts
6. Mission UI closeout + feedback
7. Policy CRUD
8. ChatGPT Actions (intake only)
9. Excellence pack
10. Gamma/Canva/Cursor adapters when credentials exist

## Related docs in repo

- [AIPOS_ARCHITECTURE.md](./AIPOS_ARCHITECTURE.md)
- [AIPOS_GOVERNANCE_RULES.md](./AIPOS_GOVERNANCE_RULES.md)
- [OPERATOR_PROFILE_AND_KNOW_ME.md](./OPERATOR_PROFILE_AND_KNOW_ME.md)
- [HARD_CONTROL_AND_ANTI_HALLUCINATION.md](./HARD_CONTROL_AND_ANTI_HALLUCINATION.md)
- [OPEN_QUESTIONS_AND_ASSUMPTIONS.md](./OPEN_QUESTIONS_AND_ASSUMPTIONS.md)
