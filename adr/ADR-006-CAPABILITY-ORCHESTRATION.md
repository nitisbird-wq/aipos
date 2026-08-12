# ADR-006 — Capability Orchestration (n8n Phase 3)

- **Status:** Approved for Implementation  
- **Date:** 2026-08-12  
- **Deciders:** Mission owner (Human) — Phase 3 design approved with governance correction  
- **Supersedes:** none  
- **Related:** AIPOS-ADR-004 / Phase 1 Decisions (D1, D2); Architecture Contract; [ADR-005](./ADR-005-PLANNING-SUBTASK-ASSIGNMENT.md); frozen n8n Mission Intake Pilot `7fLPHiiyt7sre5RR` / version `760150d8-2e1a-4a5e-93a9-48781c306583`

---

## Context

Phase 1–2 production baseline (n8n Mission Intake → CONFIRM → Notion verified Mission → Linear parent dispatch) is **PRODUCTION PASS** and **FROZEN**.

The owner target for Phase 3 is capability-based orchestration:

```text
UNDERSTAND → DECOMPOSE → ROUTE → DISPATCH → MONITOR → COLLECT
→ (Phase 4) VERIFY / REPAIR / AGGREGATE / PRESENT
```

Repo ADR-005 defines **App DB Planning → Subtask → Assignment** and explicitly excludes n8n execution. Without a boundary ADR, the n8n Capability Orchestration track would compete with ADR-005 as a second source of planning/assignment truth.

---

## Decision

### D-006.1 — Dual tracks (non-competing SoT)

| Track | ADR | Runtime truth | Role |
|---|---|---|---|
| **App-DB Planning / Assignment** | ADR-005 | PostgreSQL Mission / Plan / Subtask / Assignment | Long-term control-plane planning inside AIPOS Core |
| **n8n Capability Orchestration** | **ADR-006 (this)** | Linear workstream issues + n8n execution jobs; Notion remains mission/business/knowledge registry | Operational pilot path after Phase 2 Linear mission dispatch |

**Boundary rules**

1. ADR-006 **MUST NOT** treat Notion as runtime workstream SSOT.  
2. ADR-006 **MUST NOT** invent a second Mission Registry, Project Registry, Intake workflow, or duplicate approval product.  
3. ADR-005 aggregates are **not** required to exist before ADR-006 pilot dispatch.  
4. When App DB planning later lands, ADR-006 adapters SHOULD project/correlate to App DB via `mission_id` / `correlation_id`; they MUST NOT fork competing mission IDs.  
5. Linear remains **operational work truth** for workstreams under ADR-006. Notion remains **mission/business/knowledge truth**.

### D-006.2 — Freeze Phase 1–2 production workflow

- Workflow: `AIPOS — Mission Intake Pilot v0.1` (`7fLPHiiyt7sre5RR`)  
- Active production version: `760150d8-2e1a-4a5e-93a9-48781c306583` (31 nodes)  
- **SHALL NOT** modify those 31 nodes unless a genuine production defect is found.  
- Phase 3 MUST be implemented as **separate modular sub-workflows / components**.

### D-006.3 — Mission approval remains Phase 1 CONFIRM only

Existing Phase 1 human CONFIRM is the **Mission** approval mechanism (Notion create + subsequent Phase 2 parent Linear dispatch).

Phase 3 **MUST NOT** create a duplicate “approve every plan” gate (no mandatory G-Plan for every Mission).

### D-006.4 — Risk-based autonomous routing (governance correction)

After a Mission is confirmed and Phase 2 parent dispatch has succeeded (`Dispatch Status = Dispatched` + verified Notion):

| Risk / condition | Orchestration behavior |
|---|---|
| **L0–L1** | Auto decompose → auto route → auto dispatch workstreams |
| **L2** | Autonomous when reversible **and** within delegated authority; otherwise Human Gate |
| **L3–L4** | Explicit Human Approval before dispatch/execute |
| Secrets, production deploy/change, merge, irreversible actions, sensitive external writes | Explicit Human Approval |
| `domain.*` capabilities | Explicit Human Approval (fail closed if unvalidated) |
| Unknown capability, unknown/unverified operator, unknown authority | **Fail closed** → ask Human |

ChatGPT / Claude / Cursor / n8n **never** self-approve consequential actions.

### D-006.5 — Capability-based routing (not operator-name hardcoding)

Routing model:

```text
TASK
 → required_capabilities
 → eligible_operators (credential verified + capability match)
 → primary_operator + supporting_operator
 → tools_required
 → risk_level
 → approval_required (per D-006.4)
 → expected_artifact
 → acceptance_criteria
```

Operator families: CLAUDE, CURSOR, N8N, LINEAR (status registry), NOTION (knowledge/mission registry), HUMAN.

### D-006.6 — Workstream as executable unit

Missions decompose into Workstreams (`workstream.v1`). Each workstream maps to **one Linear child issue** with canonical tokens:

```text
AIPOS_MISSION_ID=MIS-{n}
AIPOS_WORKSTREAM_ID=WS-MIS-{n}-{nn}
```

Idempotency: reconcile-before-create using workstream idempotency key / canonical token (reuse Phase 2 pattern).

### D-006.7 — Modular components

Required modules (separate from frozen intake workflow):

1. Mission Decomposer  
2. Capability Router  
3. Workstream Dispatcher  
4. Operator Adapter layer  
5. Result Collector  

Phase 4 Verifier / Aggregator attaches to Collector interfaces; not in ADR-006 DoD.

### D-006.8 — Claude credential non-blocking for foundation

ADR, schemas, Linear taxonomy, Decomposer/Router **contracts** MUST proceed without Claude credentials. Claude-primary routes fail closed until Capability Registry shows Connected + Verified.

---

## Consequences

### Positive

- Clear SoT boundary vs ADR-005  
- Owner target (short command → autonomous L0–L1 orchestration) without duplicate approval bureaucracy  
- Frozen production intake remains stable  
- Linear/Notion roles preserved  

### Negative / follow-up

- Temporary dual planning vocabularies (ADR-005 subtask vs ADR-006 workstream) until Core planning lands  
- Claude adapter delayed until credentials  
- Risk misclassification by LLM decomposer requires fail-closed + audit  

### Forbidden without new ADR

- Modifying frozen 31-node production intake for Phase 3 features  
- Notion → runtime workstream state import  
- Mandatory plan approval for every Mission  
- Auto-route of L3–L4 / secrets / deploy / merge / irreversible / sensitive external / `domain.*` without Human  

---

## Compliance checklist

- [x] ADR documents boundary vs ADR-005  
- [x] `workstream.v1` + routing decision schemas + tests  
- [x] Linear taxonomy / issue contract documented and labels created  
- [x] Frozen baseline version unchanged  
- [ ] Decomposer + Router implemented as separate n8n workflows (TypeScript contracts started; n8n wiring next)  

---

## References

- Frozen baseline smoke: Execution `37`, Mission `MIS-3`, Linear `NIT-9`  
- Rollback version: `1e655140-03a9-4922-82b8-9689aeba6abb`  
- Seeds: `data/seeds/capabilities.json`  
- Schemas: `packages/schemas/workstream.schema.json`, `packages/schemas/routing-decision.schema.json`  
- Linear contract: `docs/LINEAR_WORKSTREAM_CONTRACT.md`  
