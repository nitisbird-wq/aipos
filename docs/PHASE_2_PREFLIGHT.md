# AIPOS Phase 2 Amendment — Capability–Connection–Authority Preflight

| Field | Value |
|---|---|
| **Document** | `PHASE_2_PREFLIGHT` |
| **Version** | `1.0.0` |
| **Status** | `Approved for implementation (Phase 2 scope)` |
| **Date** | `2026-08-04` |
| **Reason** | Add AIPOS Core Control preflight so every mission checks Tool/Connector/Agent capability, connection, authority, and readiness **before** Assignment/Execution; enforce epistemic honesty and DIY-only-after-proof |
| **Depends on** | Phase 2 Runtime Foundation (PostgreSQL adapter optional); Intake MVP |
| **Does not modify** | `docs/AIPOS_ARCHITECTURE_CONTRACT.md` (no ADR required for additive Core Control within Phase 2) |
| **Out of scope** | Multi-Agent execution, n8n routing, specialist adapters (Phase 3+) |

---

## Change log

| Version | Date | Change |
|---|---|---|
| 1.0.0 | 2026-08-04 | Initial amendment: Tool Registry + Preflight Result schemas, Intake analyze wiring, acceptance criteria, Vitest coverage |

---

## Requirements (binding for this amendment)

1. Every mission/intake analysis path evaluates Tool/Connector/Agent entries that could act for the user.
2. Evaluation covers connection status, permissions/authority, readiness, and real limits (registry `notes` / evidence).
3. `user_diy_allowed=true` only when preflight proves no ready tool path exists.
4. Registered connector that is not connected → report **display name** + **connect_instructions**.
5. Connected path with insufficient rights → list **missing_permissions**.
6. Ready tools on high risk (`operational_risk` L3/L4) still set `requires_authority_approval=true`.
7. Persist Preflight Result on the intake (`knowledge_refs.kind=preflight`) and write audit `preflight:capability_connection_authority` with selection reasons.
8. Never report Connected / Authorized / Verified labels without evidence (`ready_evidenced` / `authorized_evidenced` only when evidenced; mock ≠ connected).

---

## Contracts

| Artifact | Path |
|---|---|
| Tool Registry JSON Schema | `packages/schemas/tool-registry.schema.json` |
| Preflight Result JSON Schema | `packages/schemas/preflight-result.schema.json` |
| Seed registry | `data/seeds/tools.json` |
| Zod mirrors | `apps/web/src/lib/schemas/preflight.ts` |
| Service | `apps/web/src/lib/services/preflight-service.ts` |

---

## Intake integration

- Hook: `analyzeIntake` (after heuristic analyze, before readiness persist).
- Storage: `knowledge_refs[]` entry `{ kind: "preflight", ...PreflightResult }`.
- Audit: action `preflight:capability_connection_authority` with tool selection reasons in `policy_result`.

---

## Acceptance criteria

See `docs/PHASE_2_PREFLIGHT_ACCEPTANCE.md`.

---

## Explicit non-goals

- Does not dispatch specialists or n8n.
- Does not perform live Notion verified readback inside preflight (token presence ≤ `connected_unverified`).
- Does not replace Handling/Mapping/Readiness gates.
