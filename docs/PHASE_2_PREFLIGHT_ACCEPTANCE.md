# Phase 2 Preflight — Acceptance Criteria

**Parent:** [PHASE_2_PREFLIGHT.md](./PHASE_2_PREFLIGHT.md) v1.0.0  
**Status:** Binding for Preflight PR

## Must pass

1. Tool Registry seed validates against `tool-registry.schema.json` / Zod `ToolRegistrySchema`.
2. `runCapabilityPreflight` returns a result validating against `PreflightResultSchema` (`preflight_id` `PF-*`, `intake_id` `INT-*`).
3. Default local env (`ANALYZE_PROVIDER=none`, `NOTION_ADAPTER=mock`): local heuristic can be `ready_evidenced`; Notion is `mock_only` (never Connected/Verified).
4. `user_diy_allowed` is `false` when any matched tool is `ready_evidenced` with applicable authority.
5. `user_diy_allowed` is `true` only after no matched tool is action-ready.
6. Not-connected connector results include `connect_instructions` and named tool; overall `blocked_connector` when that path is the actionable gap.
7. Connected-unverified / insufficient path lists `missing_permissions` when permissions cannot be evidenced.
8. `operational_risk` L3/L4 ⇒ `requires_authority_approval=true` and `overall_status=requires_approval` when a tool is otherwise ready.
9. `analyzeIntake` stores `knowledge_refs` kind `preflight` and appends audit `preflight:capability_connection_authority`.
10. No code path sets `authorized_evidenced` without a live permission probe (Phase 2: none — status must not appear in default runs).
11. Vitest covers honesty, DIY gating, connector messaging, and high-risk approval.

## Out of scope checks (must remain false / absent)

- No n8n execution dispatch from preflight.
- No specialist adapter auto-route.
- No Architecture Contract rewrite in this PR.
