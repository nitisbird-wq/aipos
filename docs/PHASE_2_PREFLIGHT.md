# AIPOS Phase 2 Amendment — Capability–Connection–Authority Preflight

**Document ID:** PHASE_2_PREFLIGHT  
**Version:** 1.0.0  
**Status:** Approved for Implementation (amendment to Phase 2 Runtime Foundation)  
**Date:** 2026-08-04  
**Depends on:** Phase 2 PostgreSQL runtime adapter (PR #8 on `main`)  
**Does not include:** Multi-Agent execution, n8n routing, specialist adapters (Phase 3+)

---

## Change log

| Version | Date | Change | Reason |
|---|---|---|---|
| 1.0.0 | 2026-08-04 | Initial Preflight Core Control contract + schemas + Intake wiring | Operator requirement: every mission must evidence tool/connector/agent readiness before Assignment/Execution; honesty for Connected/Authorized/Verified claims |

---

## 1. Purpose

Add **Capability–Connection–Authority Preflight** as an AIPOS Core Control that runs on Intake confirm (Mapping Accept), **before** Assignment/Execution.

Phase 2 delivers: registry + connection probe + authority assessment + preflight result + audit evidence.  
Phase 2 does **not** dispatch specialists or n8n.

---

## 2. Hard rules (binding)

1. Every mission evaluates Tool/Connector/Agent candidates that could act on behalf of the operator.  
2. Probes must record connection status, permissions, readiness, and real limitations.  
3. Do **not** instruct the user to perform the specialist work manually until Preflight proves no acting tool is ready. Prefer connect / grant-permission guidance first.  
4. If a Connector exists but is not connected → name the Connector and provide `connect_instructions`.  
5. If connected (or credential-present) but permissions are insufficient → list `missing_permissions`.  
6. High-risk (L3–L4) work requires policy / Authority Approval even when a tool is ready.  
7. Persist Preflight result + tool selection reason as audit evidence (`preflight:evaluate`).  
8. Never report Connected / Authorized / Verified unless evidence fields support the claim (`claims.*` remain false otherwise).

---

## 3. Contracts

| Contract | Location |
|---|---|
| Tool Registry | `packages/schemas/tool-registry.schema.json`, seed `data/seeds/tool-registry.json` |
| Connection Status | `packages/schemas/connection-status.schema.json` |
| Authority Status | `packages/schemas/authority-status.schema.json` |
| Preflight Result | `packages/schemas/preflight-result.schema.json` |
| Zod runtime | `apps/web/src/lib/schemas/preflight.ts` |
| Service | `apps/web/src/lib/services/preflight-service.ts` |

### Honesty labels

| Claim | Allowed only when |
|---|---|
| Connected | `connection.status=connected` **and** `evidence.probe_id` present |
| Verified | external readback evidence (never for `mock_only`) |
| Authorized | `authority.status=authorized` **and** `grant_evidence` present |

`credential_present` and `mock_only` are **not** Connected / Verified / Authorized.

---

## 4. Intake integration

```text
Confirm Intake
  → Readiness / Handling / Mapping gates
  → mapBundleToMission
  → runCapabilityPreflight   ← Phase 2 Core Control
  → audit preflight:evaluate
  → audit mapping:accept
  → Notion sync (mock/real adapter rules unchanged)
```

- Mission `status=ready` still means **ready_for_planning** (unchanged).  
- `planning_input.assignment_execution_blocked` records that Assignment/Execution must wait on Preflight disposition / Phase 3.  
- Confirm response includes a `preflight` summary for UI/operator.

---

## 5. Dispositions

| Disposition | Meaning |
|---|---|
| `ready_for_assignment` | Evidenced Connected+Authorized tool; Assignment still Phase 3 |
| `connect_required` | Name connector + connect instructions |
| `permission_required` | List missing permissions |
| `approval_required` | Authority Approval required (e.g. L3–L4) |
| `manual_fallback_allowed` | Only after proving no ready tool |
| `blocked` | No tool path and no manual fallback |

---

## 6. Out of scope (explicit)

- Specialist auto-routing / adapters runtime  
- n8n workflow execution  
- Planning Engine / Subtask creation  
- Changing Architecture Contract status vocabulary without ADR  

---

## 7. Acceptance

See `docs/ACCEPTANCE_CRITERIA.md` § Phase 2 Preflight.
