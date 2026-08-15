# ADR-006 — AIPOS Control Tower (Governance Enforcement)

- **Status:** Proposed (awaiting Human Architecture Approval)  
- **Date:** 2026-08-07  
- **Deciders:** Mission owner (Human)  
- **Supersedes:** none  
- **Related:** Architecture Contract; Phase 1 Decisions (D1, D4); ADR-005; [CONTROL_TOWER_SCOPE.md](../docs/CONTROL_TOWER_SCOPE.md); Doctor / CI governance

---

## Context

Nitis Pro AIPOS is developed by humans and AI agents (Cursor, ChatGPT drafts, future automation). Without an enforceable control plane, agents can:

- skip dependency PRs (including MERGED-but-not-on-`main` graphs)
- expand scope across phase boundaries
- blur SSOT (Notion as runtime, n8n as authority)
- change architecture without ADR
- approve human-required decisions
- claim Verified without evidence

Existing Doctor + CI provide readiness and quality gates but are not a full **policy enforcement system** with phase/dependency/scope/architecture guards and decision evidence.

---

## Decision

### D-006.1 — Control Tower is mandatory before high-impact agent actions

AIPOS Control Tower **must run** (evaluate applicable guards and record decisions) before high-impact agent/automation actions, including but not limited to:

- multi-file architecture or schema changes
- database migrations
- integration authority/registry changes
- PR merge recommendations for high-impact work
- phase-boundary work (e.g. execution/n8n while phase is 3a)

Agents **must not** treat a green Doctor alone as permission to bypass Control Tower once CT-2 exists.

### D-006.2 — Enforcement system, not dashboard-only

Primary artifact is enforceable decisions (ALLOW / WARN / BLOCK / HUMAN_APPROVAL_REQUIRED / NOT_APPLICABLE) with evidence. UI/dashboard is optional and secondary.

### D-006.3 — Authority model (locked alignment)

| Role | Authority |
|---|---|
| User | Final authority on human-required decisions |
| AIPOS Core | Decision/control plane for missions/gates |
| Control Tower | Policy enforcement + evidence for repo/agent/integration actions |
| PostgreSQL | Runtime SSOT |
| GitHub | Code / schemas / ADR / CI / release SSOT |
| Notion | Outbound projection only; `runtime_ssot=false` |
| n8n | Execution adapter only; never Mission decision authority |
| AI providers | Analyze / draft / propose / summarize — **no approve** on human gates |

### D-006.4 — Delivery

1. **CT-1:** Docs + this ADR (no product source code)  
2. **CT-2:** CLI enforcement MVP + tests + CI profile — **starts only after Human approval of CT-1**, unless Human explicitly authorizes stacked development  

### D-006.5 — Dependency graph honesty

DependencyGuard must verify **git ancestry** against the target branch (normally `origin/main`), not PR `MERGED` state alone.

### D-006.6 — No auto-merge / no silent Architecture Contract edits

Control Tower and agents must not auto-merge. Architecture Contract changes require ADR + Human approval.

### D-006.7 — Critical guards

Architecture, Scope, Dependency, Security, and State are **Critical**. Any Critical **BLOCK** ⇒ overall **BLOCKED**.

### D-006.8 — Secrets

Never commit, print, or embed secret values in Control Tower reports, logs, or decision evidence payloads.

---

## Consequences

### Positive

- Agents have a single enforcement entry before high-impact work  
- Phase and SSOT boundaries become machine-checkable  
- Human gates and evidence are explicit  

### Negative / cost

- Additional CLI/CI step (CT-2)  
- False BLOCK risk if phase/scope configs are stale — mitigated by HUMAN_APPROVAL_REQUIRED + Human override process  

### What does not change

- Mission Intake business logic  
- Architecture Contract text (unless separate ADR)  
- Notion one-way and n8n non-authority rules  

---

## Compliance docs

- [CONTROL_TOWER_SCOPE.md](../docs/CONTROL_TOWER_SCOPE.md)  
- [CONTROL_TOWER_ARCHITECTURE.md](../docs/CONTROL_TOWER_ARCHITECTURE.md)  
- [CONTROL_TOWER_POLICY_MODEL.md](../docs/CONTROL_TOWER_POLICY_MODEL.md)  
- [CONTROL_TOWER_GUARD_MATRIX.md](../docs/CONTROL_TOWER_GUARD_MATRIX.md)  
- [CONTROL_TOWER_ACCEPTANCE_CRITERIA.md](../docs/CONTROL_TOWER_ACCEPTANCE_CRITERIA.md)  
- [CONTROL_TOWER_OPERATIONS.md](../docs/CONTROL_TOWER_OPERATIONS.md)  

---

## Approval

| Role | Decision | Date |
|---|---|---|
| Mission owner (Human) | ☐ Approve / ☐ Approve with corrections / ☐ Reject | _pending_ |
