# AIPOS Production Source of Truth (reconciliation)

**Status:** Binding operational truth as of 2026-08-12  
**Audience:** Humans and coding agents before any Phase 3 build  
**Supersedes (for n8n Phase 1–2 status):** older repo text that still says Phase 2 / n8n intake is incomplete or “PLANNED only”

This document reconciles **two different “Phase 2” meanings** that must not be blurred.

---

## 1. Dual Phase vocabularies (do not merge)

| Vocabulary | Meaning | Current truth |
|---|---|---|
| **n8n Mission Intake Phase 1–2** | Chat → CONFIRM → Notion verified Mission → Linear parent dispatch | **PRODUCTION PASS / FROZEN** |
| **App-DB Phase 2 (Postgres runtime)** | Next.js App DB SSOT via PostgreSQL adapter | **Opt-in / not production default** (file store still default) |
| **ADR-005 Phase 3a** | App-DB Planning → Subtask → Assignment | **Proposed** (file present; awaiting Human approval) |
| **ADR-006 Phase 3** | n8n Capability Orchestration after Linear parent exists | **Contracts + Decomposer v2 in repo; not production; Router/Dispatcher HELD** |

Never say “Phase 2 incomplete” without naming which vocabulary. For **n8n Mission Intake**, Phase 2 is complete.

---

## 2. n8n production baseline (authoritative)

| Field | Value |
|---|---|
| Verdict | **PHASE 2 PRODUCTION PASS** |
| Workflow name | `AIPOS — Mission Intake Pilot v0.1` |
| Workflow ID | `7fLPHiiyt7sre5RR` |
| **Active / published version ID** | `760150d8-2e1a-4a5e-93a9-48781c306583` |
| Nodes | 31 (Chat Trigger on) |
| Smoke execution | `37` |
| Mission | `MIS-3` |
| Linear | `NIT-9` |
| Notion writeback | PASS |
| Duplicates | 0 |
| Phase 1 regression | NO |
| Rollback ready | YES (prior version `1e655140-03a9-4922-82b8-9689aeba6abb`) |

### Version ID vs workflow ID

- **Workflow ID** (`7fLPHiiyt7sre5RR`) is the durable identity of the workflow object.  
- **Version ID** (`760150d8-…`) is the **active published snapshot**. Restores and rollbacks change the active version ID; they do not change the workflow ID.  
- Agents MUST cite both when claiming freeze status.

### Freeze rule

Do **not** modify the 31-node production workflow for Phase 3 features. Phase 3 is separate modular workflows/components only.

---

## 3. Phase 3 n8n prototype (not production)

| Field | Value |
|---|---|
| Name | `AIPOS — P3 Decompose + Route v0.1` |
| Workflow ID | `xizHBNDiy9W4RLM4` |
| Active | **false** (`activeVersionId: null`) |
| Draft version ID | `85dd07da-1993-4377-8e8a-70062714e3c2` |
| Nodes | 3 — Webhook → Code → Respond |
| Publish | **Do not publish** |
| Duplicate | **Do not create a second P3 workflow** |

### Assessment vs approved ADR-006 / Decomposer v2

| Approved design | Prototype reality | Verdict |
|---|---|---|
| Work-first decompose (objective→domain→actions→deps→deliverable→capabilities) | Keyword heuristic → **single** WS titled `Execute: …` | **Non-compliant** |
| Variable workstream count | Always 1 workstream | **Non-compliant** |
| Operators deferred (`unassigned`) until Router | Assigns Claude/Cursor/n8n in same Code node | **Premature routing** |
| Capabilities after work definition | Caps chosen from title keywords first | **Capability-forced** |
| D-006.4 risk autonomy | Partially encoded in same node | Useful sketch only |
| Separate Decomposer / Router / Dispatcher | Combined into one Code node | Not modular |
| `decomposer_version` | Emits `ADR-006.v1` | Stale vs repo `ADR-006.v2` |

**Conclusion:** Keep as inactive reference only. Rewrite later against `docs/MISSION_DECOMPOSER_CONTRACT.md`. Do not treat as decomposition authority. Do not route live missions through it.

---

## 4. ADR status

| ADR | File | Status | Role |
|---|---|---|---|
| **ADR-005** | `adr/ADR-005-PLANNING-SUBTASK-ASSIGNMENT.md` | **Present — Proposed** (awaiting Human approval) | App-DB Planning / Subtask / Assignment track |
| **ADR-006** | `adr/ADR-006-CAPABILITY-ORCHESTRATION.md` | **Present — Approved for Implementation** of contracts; build gated | n8n Capability Orchestration track |

ADR-005 is **not missing**. It is not yet Human-approved for App-DB schema expansion. ADR-006 **does not require** ADR-005 aggregates to exist before a future ADR-006 pilot (D-006.1.3), but the tracks must remain non-competing SoT.

---

## 5. What is explicitly HELD

- Capability Router production path  
- Workstream Dispatcher  
- Live mission routing / dispatch of child Linear workstreams  
- Publishing `xizHBNDiy9W4RLM4`  
- Any edit to frozen intake `7fLPHiiyt7sre5RR` / `760150d8-…`  
- Treating App Postgres default runtime as production  
- **Command Gateway runtime** (design only: `docs/COMMAND_GATEWAY_DESIGN.md`, ADR-007 Proposed)  

**Next build gate:** accept / refine Mission Decomposer contract (`ADR-006.v2`) with multi-domain examples — **before** Router/Dispatcher. Command Gateway implementation waits on design acceptance (ADR-007) and must not duplicate Intake.

---

## 6. Evidence pointers

- Decomposer contract: `docs/MISSION_DECOMPOSER_CONTRACT.md`  
- Command Gateway design (not implemented): `docs/COMMAND_GATEWAY_DESIGN.md`, `adr/ADR-007-COMMAND-GATEWAY.md`  
- Workstream schemas: `packages/schemas/workstream*.json`  
- Fixtures: `data/seeds/decomposer-examples/`  
- Linear ops contract: `docs/LINEAR_WORKSTREAM_CONTRACT.md`  
- App capability inventory (distinct from n8n production): `docs/CURRENT_CAPABILITIES.md`
