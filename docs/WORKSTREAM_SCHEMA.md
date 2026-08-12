# Workstream Schema (ADR-006)

Machine-readable: `packages/schemas/workstream.schema.json`  
Routing: `packages/schemas/routing-decision.schema.json`  
Zod: `apps/web/src/lib/schemas/workstream.ts`  
Policy helper: `apps/web/src/lib/orchestration/risk-autonomy.ts`

## Purpose

Executable unit after Phase 2 mission dispatch. Linear holds operational instances; Notion holds mission registry.

## Risk-based autonomy (D-006.4)

- L0–L1: auto decompose / route / dispatch after Mission CONFIRM  
- L2: auto only if reversible AND within delegated authority; else Human  
- L3–L4 / secrets / deploy / merge / irreversible / sensitive external / domain.*: Human  
- Unknown capability/operator/authority: fail closed  

No mandatory plan approval for every Mission.
