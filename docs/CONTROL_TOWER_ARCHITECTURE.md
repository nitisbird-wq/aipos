# AIPOS Control Tower v1 — Architecture

| Field | Value |
|---|---|
| **Document** | `CONTROL_TOWER_ARCHITECTURE` |
| **Version** | `1.0.0` |
| **Status** | `Draft — awaiting Human Architecture Approval` |
| **Date** | `2026-08-07` |
| **ADR** | [ADR-006](../adr/ADR-006-AIPOS-CONTROL-TOWER.md) |

---

## Position in the system

```text
User (final authority)
        │
        ▼
AIPOS Core (decision / control authority)
        │
        ├── Control Tower  ←── enforcement before high-impact agent/automation actions
        │         │
        │         ├── Policy / Validation / Evidence / Decision engines
        │         └── Guards + Connection Registry + Runtime Health
        │
        ├── App DB (PostgreSQL) = runtime SSOT
        ├── GitHub = code / schemas / ADR / CI / release SSOT
        ├── Notion = outbound projection only (not runtime SSOT)
        ├── n8n = execution adapter only (not authority)
        └── AI providers = analyze / draft / propose / summarize (no human-gate approve)
```

Control Tower does **not** replace AIPOS Core business services. It gates and records whether an action is allowed under policy.

---

## Component model

```text
AIPOS Control Tower
├── Policy Engine          # load policies / phases / severity
├── Validation Engine      # structural checks on inputs + diffs
├── Evidence Engine        # collect non-secret evidence refs
├── Decision Engine        # aggregate guard results → overall + score
├── Connection Registry    # systems, direction, authority, SSOT flags
├── Dependency Guard
├── Scope Guard
├── Architecture Guard
├── State Guard
├── Security Guard
├── Runtime Health         # RuntimeGuard (+ Integration health categories)
└── Control Center surface # CLI mandatory; UI optional/thin
```

Additional guards in the v1 matrix (same Decision Engine): GitGuard, DatabaseGuard, IntegrationGuard, AIAgentGuard, QualityGuard, CostGuard (telemetry-first).

---

## Enforcement lifecycle

```text
Mission / Action request
  → Context Resolve      (repo, branch, commit, phase, mission_id, requirement_id, actor, correlation_id)
  → Policy Evaluate      (load phase + policies)
  → Dependency Check
  → Scope Check
  → Security Check
  → Architecture Check
  → State Check
  → (other applicable guards: Git, Database, Integration, Quality, AI Agent, Cost, Runtime)
  → Decision Engine      (ALLOW | WARN | BLOCK | HUMAN_APPROVAL_REQUIRED | N/A aggregate)
  → Execute              (only if not BLOCK / not unmet HUMAN_APPROVAL_REQUIRED for critical)
  → Verify               (readback / CI / health where applicable)
  → Evidence             (decision records)
  → Audit                (append-only evidence; report file in CT-2)
```

No direct status PATCH. Any mission/state mutation remains under Core transition commands with full audit fields (actor, timestamp, reason, correlation_id, causation_id, idempotency_key when relevant, policy_result, previous_state, new_state).

---

## Decision record (every guard)

| Field | Required |
|---|---|
| `decision_id` | yes |
| `guard` | yes |
| `rule_id` | yes |
| `severity` | critical \| high \| medium \| low |
| `result` | ALLOW \| WARN \| BLOCK \| HUMAN_APPROVAL_REQUIRED \| NOT_APPLICABLE |
| `reason` | yes |
| `evidence` | yes (refs only; never secret values) |
| `actor` | yes |
| `mission_id` | when known |
| `requirement_id` | when known |
| `adr_ids` | when architecture/scope impact |
| `branch` | yes for repo actions |
| `commit_sha` | yes for repo actions |
| `pr_number` | when PR context |
| `correlation_id` | yes |
| `timestamp` | yes |

---

## Readiness score (0–100)

**Critical guards:** Architecture, Scope, Dependency, Security, State.

If any Critical guard result = **BLOCK** → Overall = **BLOCKED** (score may still be computed for diagnostics but status is BLOCKED).

Else weighted score:

| Guard family | Weight |
|---|---:|
| Architecture | 15 |
| Scope | 15 |
| Dependency | 15 |
| Security | 15 |
| State | 10 |
| Git | 5 |
| Database | 10 |
| Quality | 10 |
| Integration | 5 |

**Status bands**

| Score | Status |
|---|---|
| 90–100 | READY |
| 75–89 | CONDITIONALLY_READY |
| 50–74 | REQUIRES_ACTION |
| 0–49 | BLOCKED |

CLI / CI exit codes (CT-2): `0` READY, `1` WARN/CONDITIONALLY_READY, `2` BLOCKED, `3` TOOL/ENVIRONMENT ERROR.

---

## Phase awareness

Control Tower must load current phase config (CT-2: `config/control-tower/phases.json`).

Example Phase **3a**:

| Allowed | Blocked |
|---|---|
| planning, subtask L0–L1 schemas/docs, assignment proposal | execution, n8n runtime, artifact, review, closeout |

If the working tree / PR diff touches a **blocked** domain for the declared phase → **ScopeGuard / ArchitectureGuard BLOCK**.

---

## Relationship to Doctor

| Tool | Role |
|---|---|
| `npm run doctor` | Repository readiness audit (existing) |
| Control Tower | Policy enforcement + guard decisions + phase/dependency graph checks |

CT-2 must reuse Doctor where possible; must not fork a second conflicting policy language without mapping.

---

## Non-goals (architecture)

- Control Tower is not the Mission runtime SSOT
- Control Tower is not Notion
- Control Tower does not grant ChatGPT confirm/dispatch authority
- Control Tower does not auto-merge
