# Acceptance Criteria — Mission Intake MVP v0.1

**Architecture contract:** [AIPOS_ARCHITECTURE_CONTRACT.md](./AIPOS_ARCHITECTURE_CONTRACT.md)

## Build package (docs)

- [x] Scope limited to Mission Intake MVP
- [x] Governance rules represented
- [x] Intake vs Orchestration separated
- [x] No real specialist execution in scope
- [x] User confirmation mandatory before Mission creation
- [x] Risk and sensitivity separate
- [x] Handling Gate and Authority Gate separate
- [x] Chat-only destination = `intake_channel`
- [x] Notion writes require verified responses
- [x] External actions auditable
- [x] No direct status PATCH
- [x] Schemas versioned
- [x] Duplicate intake prevented (idempotency_key)
- [x] Sensitive data handling documented
- [x] Usable from iPad and desktop (responsive requirement)
- [x] Core can extend later without replacing Intake frontend
- [x] Enforceable Architecture Contract (verification, ownership, idempotency, sync failure)

## Product MVP (implementation)

1. Submit mission via web/chat → analysis → understanding  
2. Correct / add info / confirm / cancel works  
3. Confirm creates Mission with `status=ready` (**ready_for_planning**), empty `subtask_ids`  
4. Mapping Gate rejects with explicit codes when incomplete  
5. Notion sync success only when verified readback; failure visible; mission still persisted  
6. Dashboard lists missions with sync status  
7. Detail shows audit / transitions  
8. Governance viewer lists seeded policies  
9. No specialist API calls in code paths  
10. Responsive layout verified on desktop + iPad widths  

## Enforceable tests (Architecture Contract)

Before MVP is “pass” for deploy readiness:

1. Confirming the same intake/idempotency key does not create duplicate Missions  
2. Mapping the same confirmed bundle version returns the same `mission_id`  
3. Notion sync retry does not create a second page when `notion_page_id` exists  
4. Notion outage leaves Mission in App DB with `sync_status=failed`  
5. Successful retry updates/uses the same Notion page id  
6. Changing mission source version after verify invalidates prior verification / requires re-sync path  
7. Direct `PATCH /missions/{id}/status` is rejected  
8. Every allowed transition writes an audit event with actor, correlation_id, previous/new state  
9. ChatGPT (or any non-user actor) cannot confirm intake without user session  
10. Intake UI works without n8n  
11. Notion is never used as the sole runtime transaction store  
12. Intake channel and Notion registry destinations are recorded as separate destination entries  

## Phase 2 Preflight (Capability–Connection–Authority)

**Contract:** [PHASE_2_PREFLIGHT.md](./PHASE_2_PREFLIGHT.md) v1.0.0

1. Confirming an intake runs Preflight and writes audit action `preflight:evaluate` with disposition + selection reason  
2. Preflight never sets `claims.connected` / `claims.authorized` / `claims.verified` without supporting evidence  
3. When a matching Connector exists but is not evidenced Connected → disposition `connect_required` includes tool name + `connect_instructions`  
4. When permissions are insufficient → `missing_permissions` listed; disposition `permission_required` (or connect path surfaces grant actions)  
5. Manual fallback (`manual_fallback.allowed=true` / `NO_TOOL_USE_MANUAL`) only after Preflight proves no ready acting tool  
6. L3–L4 risk yields `approval_required` (or required_approvals includes `authority_approval`) even if credentials are present  
7. Mission stores Preflight under `gate_results.preflight` and blocks Assignment/Execution via `assignment_execution_blocked` until disposition allows later phases  
8. No specialist adapter / n8n dispatch is invoked by Preflight (Phase 2 evaluate-only)  
