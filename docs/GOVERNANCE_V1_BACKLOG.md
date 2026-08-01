# Governance v1 Backlog (post–Architecture Contract)

**Status:** Deferred from Commit 1 — do not block governance baseline  
**Parent:** [AIPOS_ARCHITECTURE_CONTRACT.md](./AIPOS_ARCHITECTURE_CONTRACT.md)  
**Created:** 2026-08-02

These items upgrade documentation governance from “enforceable contract text” to “versioned + traceable + lifecycle-managed.” Implement via ADR(s) before treating Governance as v1 complete.

---

## G-V1-01 — Architecture Version Compatibility

### Problem

ADR, Architecture Contract, API Contract, Acceptance Criteria, and `AGENTS.md` exist but lack an explicit version graph.

### Target

```text
Architecture Contract v1.0
        │
        ├── API Contract v1.0
        ├── Schema packages v1.0
        ├── Acceptance Criteria v1.0
        └── AGENTS.md (aligned revision)
```

When Contract becomes v1.1, a compatibility matrix SHALL list which docs/schemas must bump.

### Deliverable

- `docs/ARCHITECTURE_COMPATIBILITY.md` (or section in Contract)
- Version headers on Contract / API / Acceptance / Phase 1 Decisions
- CI check (optional later): fail if Contract version referenced by AGENTS is missing

---

## G-V1-02 — Traceability Matrix

### Problem

Requirements, ADRs, and contracts are not linked in one reviewable table for CI/agents.

### Target columns

| Mission | Requirement | ADR | API | Test / AC | Status |
|---|---|---|---|---|---|
| MIS-… | REQ-… | ADR-004 | POST /intakes | AC-001 | ✅/⬜ |

### Deliverable

- `docs/TRACEABILITY_MATRIX.md` (or `data/governance/traceability.csv`)
- Seed rows for Intake MVP enforceable tests (AC contract §12)
- Doctor/CI can answer: “does this requirement have a test?”

---

## G-V1-03 — Decision Lifecycle

### Problem

“Locked decision” exists without a full lifecycle.

### Target states

```text
Draft → Proposed → Review → Approved → Locked → Deprecated → Archived
```

### Rules

| State | Rule |
|---|---|
| Locked | Change requires a new ADR |
| Deprecated | Temporary use allowed; MUST NOT cite in new work |
| Archived | MUST NOT use |

### Deliverable

- Decision lifecycle section in ADR template + Phase 1 Decisions
- Notion Governance Asset Status mapping (optional sync)
- Agent rule in `AGENTS.md` once lifecycle ships

---

## Explicit non-goals for Commit 1

- Renaming `ready` / `ready_to_dispatch` enums  
- Application code changes  
- Enabling production Notion/LLM credentials  
