# Open Questions and Assumptions

## Phase 1.0 decisions (2026-08-01) — resolved from Command Center study

Binding docs:

- [AIPOS_PHASE_1_DECISIONS.md](./AIPOS_PHASE_1_DECISIONS.md)
- [AIPOS_ARCHITECTURE_CONTRACT.md](./AIPOS_ARCHITECTURE_CONTRACT.md) — verification, field ownership, idempotency, state semantics, Notion failure
- [OPERATOR_PROFILE_AND_KNOW_ME.md](./OPERATOR_PROFILE_AND_KNOW_ME.md)
- [HARD_CONTROL_AND_ANTI_HALLUCINATION.md](./HARD_CONTROL_AND_ANTI_HALLUCINATION.md)
- Notion ADR: [AIPOS-ADR-004](https://app.notion.com/p/3afbc165be4c811bbdd1c8d7101a6013)

### Architecture review (2026-08-02) — Approve with Conditions → contract

Critical/High gaps closed in Architecture Contract without renaming live schema enums yet:

- `ready` = ready_for_planning (semantic)
- `ready_to_dispatch` = ready_to_map (semantic)
- Future rename to literal `ready_for_planning` remains an open schema ADR if desired.

### Governance v1 backlog (non-blocking for Commit 1)

See [GOVERNANCE_V1_BACKLOG.md](./GOVERNANCE_V1_BACKLOG.md):

1. Architecture Version Compatibility matrix  
2. Traceability Matrix (REQ ↔ ADR ↔ API ↔ Test)  
3. Decision Lifecycle (Draft → … → Locked → Deprecated → Archived)

Locked:

1. Tool chain: ChatGPT → Claude → Cursor → n8n → Notion; AIPOS Core remains control plane.
2. Confirm-once then auto L0–L1; L3–L4 need Authority.
3. Know-Me sync from Identity/Role/Command Center (not blank profile).
4. Anti-hallucination via epistemic labels, Three-State, Evidence/Handoff, G0–G5, grounded LLM.
5. Hard foundation (Postgres + Notion verified) before full auto-execute.
6. Existing Mission Registry in Notion is preferred target for sync (confirm property map at wiring time).
7. ChatGPT Actions remain Phase 0.2 intake channel after Hard Control.

Still open (non-blocking for docs):

1. Neon vs Supabase vs other Postgres host for production?
2. When to enable real `ANALYZE_PROVIDER` (openai/claude) behind env flag?
3. Approval channel for L3–L4 in pilot (in-app only vs n8n chat)?

## Assumptions (MVP v0.1 — still valid for Intake-only runtime)

1. Single operator tenant is acceptable for v0.1 auth.
2. Intake channel for v0.1 is the **web app** (`source: web_app`), not ChatGPT yet.
3. Analysis can be rule-based stub without external LLM.
4. Postgres (Neon) is acceptable for Vercel deployment.
5. Notion Mission database will be created/shared by the operator before sync testing.
6. Domain capabilities (`domain.police`, etc.) remain `unvalidated` and never auto-route in MVP.
7. Mission is created only after Mapping Gate (prefer no orphan `draft` Mission rows).

## Open questions for the user

1. Neon vs Supabase vs other Postgres host?
2. When to add ChatGPT Custom GPT Actions (Phase 0.2)?
3. Notion database: create new vs use existing?
4. Branding / Thai-first UI copy required in v0.1?
5. Should analyze stub remain offline-only, or allow optional LLM behind env flag in v0.1?

## Documented contradictions resolved

| Topic | Decision |
|---|---|
| ready_to_dispatch vs ready | Bundle readiness vs Mission.status |
| Notion as SSOT vs runtime | App DB runtime; Notion projection |
| SQLite preference earlier | Superseded by Postgres for Vercel reliability |

## Phase B implementation assumptions (non-blocking)

1. **Understanding route path:** Phase B implements `/intake/[id]/understanding` (per implementation brief). `docs/UI_FLOW.md` lists `/intake/[id]`; the longer path is the binding UI route for v0.1.
2. **ORM:** Drizzle with PostgreSQL dialect is used; SQL migration files remain Neon/Postgres compatible.
3. **Dev persistence:** When `DATABASE_URL` is unset, a clearly marked **development file/memory adapter** under `.data/` is used. This is not production architecture and must never be silent in logs/UI.
4. **Auth:** MVP uses a signed cookie session for the single operator (`OPERATOR_EMAIL` / `OPERATOR_PASSWORD`), equivalent in spirit to Auth.js credentials for one tenant.
5. **Notion adapter:** Default is mock (`NOTION_ADAPTER=mock`). Real SDK path exists behind interface but is not invoked without verified credentials/config; sync success still requires a verified page/record ID.
6. **Analyze provider:** Default `ANALYZE_PROVIDER=none` uses deterministic heuristic stub only (no external AI credentials).
7. **Readiness Gate naming:** Gate evaluates IntakeMissionBundle readiness transitions (`needs_input` → `awaiting_confirmation` → `ready_to_dispatch`) separately from Mapping Gate.
8. **Notion + Handling Gate:** Allow-listed Mission Registry sync to `system=notion` / `purpose=mission_registry` is permitted after sensitivity acknowledgment in MVP; other external transfers of sensitive data still fail Handling Gate pending Authority Approval.

## Phase B Revision 1 assumptions

1. **mock_synced status:** Mock Notion adapter persists `sync_status=mock_synced` (never `synced`). UI copy: “Mock sync only — no external Notion record was created.” “Notion verified” is reserved for real external page/record IDs.
2. **Retry gate:** `POST /missions/{id}/notion/retry` requires `sync_status=failed`, unless `force=true` and `diagnostic=true` for authorized diagnostics. `notion:retry_success` / `notion:retry_mock_synced` audit events are written only when previous state was `failed`.
3. **Success criteria split:** Mission `success_criteria` are outcome-derived; system intake checks live under `gate_results` / `intake_validation` (also mirrored in `knowledge_refs` on the bundle).
## Phase B.2 assumptions (Chat-first)

1. **Primary UX:** `/intake` is Mission Commander (chat-first). Structured form is collapsible “Advanced mission details” only.
2. **Conversation layer:** States (`awaiting_mission` … `cancelled`) live in `knowledge_refs` (`kind: conversation`) and map to Bundle `readiness_status` without replacing the Bundle schema.
3. **Home route:** `/` redirects to `/intake` (New Mission). Dashboard remains at `/missions`.
4. **Legacy understanding route:** `/intake/[id]/understanding` kept as a pointer to Chat-first; not the primary flow.
