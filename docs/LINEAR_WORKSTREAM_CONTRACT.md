# Linear Workstream Contract (ADR-006)

**Status:** Active with ADR-006  
**Team:** `Nitis Pro : AIPOS` (`acee324a-f2d8-416d-96ef-237298e82986`)  
**Parent pattern:** Phase 2 mission issue with `AIPOS_MISSION_ID=MIS-{n}`

---

## 1. Roles

| System | Truth class |
|---|---|
| **Linear** | Operational workstream / execution status |
| **Notion** | Mission / project / knowledge / business registry |
| **n8n** | Orchestration / adapters |
| **Frozen intake workflow** | Mission create + parent Linear dispatch only (`760150d8-2e1a-4a5e-93a9-48781c306583`) |

Do not create a second task-management product. Workstreams are Linear child issues.

---

## 2. Issue hierarchy

```text
Parent (Phase 2): NIT-{n}  — mission correlator
  Child: NIT-{m}           — one workstream
```

Child description **MUST** include exact lines:

```text
AIPOS_MISSION_ID=MIS-{n}
AIPOS_WORKSTREAM_ID=WS-MIS-{n}-{nn}
```

Optional metadata block:

```text
idempotency_key=ws:MIS-{n}:{nn}:v1
primary_operator={unassigned|claude|cursor|n8n|notion|human}
risk_level={L0|L1|L2|L3|L4}
approval_required={true|false}
```

At **decompose** time (`ADR-006.v2`), `primary_operator` MUST be `unassigned`. Router (HELD) assigns operators later. See `docs/MISSION_DECOMPOSER_CONTRACT.md`.

Idempotency: reconcile-search for `AIPOS_WORKSTREAM_ID=...` before create (Phase 2 pattern).

---

## 3. Label taxonomy

| Label | Purpose |
|---|---|
| `ws` | Marks a workstream (child) issue |
| `mission-parent` | Marks Phase 2 parent mission issue (optional) |
| `op:claude` | Primary operator Claude |
| `op:cursor` | Primary operator Cursor |
| `op:n8n` | Primary operator n8n |
| `op:notion` | Primary operator Notion |
| `op:human` | Primary operator Human |
| `cap:research` | Capability family hint |
| `cap:code` | Capability family hint |
| `cap:docs` | Capability family hint |
| `cap:automation` | Capability family hint |
| `cap:strategy` | Capability family hint |
| `cap:knowledge` | Capability family hint |
| `cap:data` | Capability family hint |
| `cap:ops` | Capability family hint |
| `risk:L0` … `risk:L4` | Workstream risk |
| `needs-approval` | Human Gate required before dispatch/execute |
| `auto-dispatch` | Eligible for autonomous dispatch under D-006.4 |
| `blocked-unknown` | Fail-closed unknown capability/operator/authority |

---

## 4. Cursor agent contract

For `op:cursor` workstreams, title/body SHOULD include:

- Objective  
- Acceptance criteria  
- Repo hint (`nitisbird-wq/aipos` when applicable)  
- Explicit constraints: no Architecture Contract changes unless Mission says so; no production deploy; no secret rotation  

Cursor Cloud Agents already consume Linear issues (proven path). n8n Adapter Cursor creates/updates the issue; it does not embed Cursor API keys in the frozen intake workflow.

---

## 5. Status mapping (operational)

Linear workflow states remain team defaults. AIPOS interprets via labels + description tokens + n8n collector:

| Workstream.status | Linear signal |
|---|---|
| `ready` / `dispatched` | Backlog/Todo + `auto-dispatch` or `needs-approval` cleared |
| `running` | In Progress |
| `succeeded` | Done/Completed |
| `failed` / `blocked` | Canceled or label `blocked-unknown` / comment |

Mission coarse status is **not** mirrored into every child state (Architecture Contract / ADR-005 coarse Mission rule).

---

## 6. Risk-based dispatch (no duplicate Mission approval)

Phase 1 CONFIRM remains the only Mission approval.

| Condition | Labels / action |
|---|---|
| L0–L1 | `auto-dispatch` → dispatcher may create child + invoke adapter |
| L2 reversible + delegated | `auto-dispatch` |
| L2 otherwise / L3–L4 / secrets / deploy / merge / irreversible / sensitive external / domain.* | `needs-approval` → Human |
| Unknown capability/operator/authority | `blocked-unknown` → ask Human |

---

## 8. Related n8n workflows

| Workflow | ID | Status |
|---|---|---|
| Mission Intake Pilot v0.1 | `7fLPHiiyt7sre5RR` | **FROZEN** production active version `760150d8-2e1a-4a5e-93a9-48781c306583` (PHASE 2 PRODUCTION PASS) |
| P3 Decompose + Route v0.1 | `xizHBNDiy9W4RLM4` | Draft **inactive** (`activeVersionId=null`) — heuristic; **non-compliant** with ADR-006.v2; do not publish |

See `docs/PRODUCTION_SOURCE_OF_TRUTH.md` for workflow ID vs version ID and freeze rules.

Do not publish P3 until Dispatcher contract + smoke plan are ready.
