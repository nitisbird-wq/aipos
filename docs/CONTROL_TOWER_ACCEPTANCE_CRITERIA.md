# AIPOS Control Tower v1 — Acceptance Criteria

| Field | Value |
|---|---|
| **Document** | `CONTROL_TOWER_ACCEPTANCE_CRITERIA` |
| **Version** | `1.0.0` |
| **Status** | `Draft — awaiting Human Architecture Approval` |
| **Date** | `2026-08-07` |

---

## CT-1 (Architecture / Docs) — must pass before Human Architecture Approval

1. Docs exist and cross-link: Scope, Architecture, Policy Model, Guard Matrix, Acceptance, Operations + ADR-006.  
2. ADR-006 states: Control Tower **must run before high-impact agent actions**; User remains final authority; no auto-merge.  
3. SSOT ownership matches Architecture Contract: Postgres runtime; Notion outbound-only; n8n execution adapter; GitHub code/ADR/CI; AIPOS Core control.  
4. Decision vocabulary includes ALLOW / WARN / BLOCK / HUMAN_APPROVAL_REQUIRED / NOT_APPLICABLE.  
5. Guard matrix covers Architecture, Scope, Dependency, Git, Database, State, Security, Integration, AI Agent, Quality, Cost, Runtime.  
6. Connection matrix locks Notion `runtime_ssot=false` outbound; n8n not SSOT; Postgres `runtime_ssot=true`.  
7. Enforcement lifecycle documented end-to-end including Evidence + Audit.  
8. Readiness score weights + Critical-guard BLOCK override documented.  
9. Phase awareness documented (3a example blocks execution/n8n/artifact/review/closeout).  
10. DependencyGuard requires **ancestor graph** verification — not PR state alone — with #10/#12 called out as reality example.  
11. CT-1 PR is **docs/ADR only** (no `apps/**` product source changes).  
12. No secret values in docs.

---

## CT-2 (Enforcement MVP) — acceptance after CT-1 approval

### CLI

- [ ] `npm run control` / `control:status` / `control:check` / `control:connections` / `control:evidence` exist  
- [ ] Status output shows guard colors + integration health + Overall + Score  
- [ ] Never prints credential values  
- [ ] Exit codes: 0 READY, 1 WARN/CONDITIONALLY_READY, 2 BLOCKED, 3 TOOL/ENV ERROR  

### Guards (automated tests)

- [ ] architecture violation → BLOCK  
- [ ] scope violation → BLOCK  
- [ ] missing dependency (non-ancestor) → BLOCK  
- [ ] stale/wrong PR handling uses `gh`  
- [ ] direct main development → BLOCK/WARN per policy  
- [ ] secret candidate → BLOCK  
- [ ] Notion inbound mutation definition → BLOCK  
- [ ] n8n as SSOT → BLOCK  
- [ ] invalid state transition → BLOCK  
- [ ] allowed planning change → ALLOW  
- [ ] missing Docker → NOT_CONFIGURED (not Critical)  
- [ ] unavailable external command → controlled error (exit 3 path)  
- [ ] report contains no secret  

### Evidence / CI

- [ ] `AIPOS_CONTROL_TOWER_REPORT.md` generated and **gitignored**  
- [ ] CI runs `npm run control:check -- --profile pr` after existing quality checks  
- [ ] CI fails only on BLOCKED/Critical (warnings visible)  
- [ ] Existing Secret scan / Verify not weakened  

### Integration

- [ ] Reuses Doctor where practical; does not redesign business services  
- [ ] Dashboard extension optional/minimal and only if Control Center structure exists  

---

## Explicit non-acceptance

- Claiming CT “done” with docs-only and no CT-2 when Human asked for enforcement MVP after approval  
- Auto-merge enabled  
- Bidirectional Notion  
- n8n as decision authority  
- Architecture Contract silent edit  
