# AIPOS Control Tower v1 — Operations

| Field | Value |
|---|---|
| **Document** | `CONTROL_TOWER_OPERATIONS` |
| **Version** | `1.0.0` |
| **Status** | `Draft — awaiting Human Architecture Approval` |
| **Date** | `2026-08-07` |

---

## Who runs Control Tower

| Actor | When |
|---|---|
| Human / Mission owner | Architecture approval; human gates; merge |
| Cloud / Cursor agents | Before high-impact repo or integration actions (ADR-006) |
| CI | PR profile after format/lint/test/build/doctor/secret |
| Local developer | Pre-PR `control:check` |

---

## CT-1 (now)

Docs + ADR only. No CLI yet.

**Human action required:** review + approve ADR-006 and CT-1 docs; merge CT-1 PR; then authorize CT-2.

---

## CT-2 planned commands (do not invent behavior before implementation)

```bash
npm run control                 # help / default status
npm run control:status          # guard + health + score
npm run control:check           # pre-PR / agent gate (exit codes)
npm run control:connections     # registry + health (no secrets)
npm run control:evidence        # write local report
```

Example status shape (illustrative):

```text
Nitis pro:aipos — Control Tower

Architecture        GREEN
Scope               GREEN
Dependency          GREEN
Git                 GREEN
Database            GREEN
State               GREEN
Security            GREEN
Integration         AMBER
Quality             GREEN
AI Agents           GREEN

GitHub              HEALTHY
Postgres            HEALTHY
Docker              NOT_CONFIGURED
n8n                 NOT_CONFIGURED
Notion              MOCK
AI Provider         NOT_CONFIGURED

Overall: CONDITIONALLY_READY
Score: 88/100
```

---

## Status sources of truth

| Domain | Source |
|---|---|
| GitHub PR/CI | `gh` (not agent memory) |
| Repository | `git` |
| Database | safe health only |
| Docker | `docker info` / compose ps if available |
| n8n | health endpoint when configured |
| Notion | config/adapter state; safe API if enabled |
| AI providers | configuration **existence** only by default |

**Never** print tokens, passwords, connection strings, or private keys.

---

## Report artifact (CT-2)

- Path: `AIPOS_CONTROL_TOWER_REPORT.md` (repo root)  
- Must be **gitignored** (add in CT-2 alongside Doctor report)  
- Contents: timestamp, repo, branch, commit, phase, mission, requirement, guards, decisions, connections, health, CI, risks, recommended actions  

---

## Failure handling

| Situation | Operator action |
|---|---|
| BLOCKED Critical | Fix cause or obtain Human approval + ADR; do not bypass |
| CONDITIONALLY_READY | Document WARNs; proceed only if Human accepts |
| TOOL/ENV ERROR | Install/fix tooling (`gh`, docker, DB); re-run |
| Secret scan fail | Rotate/remove secret; never commit `.env` |

---

## Rollback

| Layer | Rollback |
|---|---|
| CT-1 docs | Revert PR / supersede ADR status |
| CT-2 CLI | Revert PR; remove CI step; delete ignored reports |
| Policies | Prefer new policy version + changelog; avoid silent Critical weakening |

---

## Coordination with open work (reality)

| Item | Ops note |
|---|---|
| PR #11 Developer Control Center | Optional UI host for CT-2; not blocking CT-1; currently OPEN with Secret scan failure |
| PR #12 hardening on main | DependencyGuard example — prefer ancestor check before treating transactional hardening as done on `main` |
| Phase 3a feature PRs | Keep out of Control Tower PRs |

---

## Safety checklist (always)

- No credentials committed  
- No secret values in reports/logs  
- No auto-merge / force-push / production deploy from Control Tower  
- No Architecture Contract silent change  
- No Notion inbound runtime mutation  
- No n8n as SSOT/authority  
- No bypass of human gates  
