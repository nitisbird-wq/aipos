# Workstream Schema (ADR-006.v2)

Machine-readable:
- `packages/schemas/workstream.schema.json` (workstream unit)
- `packages/schemas/workstream-plan.schema.json` (`decomposer_version: ADR-006.v2`)
- `packages/schemas/routing-decision.schema.json` (Router — **HELD**)

Zod: `apps/web/src/lib/schemas/workstream.ts`  
Decomposer contract: `docs/MISSION_DECOMPOSER_CONTRACT.md`  
Fixtures: `data/seeds/decomposer-examples/`  
Policy helper: `apps/web/src/lib/orchestration/risk-autonomy.ts` (routing — HELD)

## Purpose

Executable unit after Phase 2 mission dispatch. Linear holds operational instances; Notion holds mission registry.

## Decomposition (work-first)

Plan header carries: `mission_objective` → `desired_outcome` → `success_criteria` → `domain` → `reasoning_actions` → `final_deliverable` → `explicit_assumptions` / `owner_questions`.

Each workstream must include concrete `objective`, `expected_output.description`, `acceptance_criteria`, `dependencies`, then `required_capabilities` (derived after the work). Decomposer sets `primary_operator: unassigned`.

## Risk-based autonomy (D-006.4)

- L0–L1: auto decompose / route / dispatch after Mission CONFIRM  
- L2: auto only if reversible AND within delegated authority; else Human  
- L3–L4 / secrets / deploy / merge / irreversible / sensitive external / domain.*: Human  
- Unknown capability/operator/authority: fail closed  

No mandatory plan approval for every Mission. Router/Dispatcher remain **HELD** until decomposer examples pass review.
