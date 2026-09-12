# ADR-007 — AIPOS Capability Orchestration

- **Status:** Approved — Owner decision recorded 2026-09-12  
- **Date:** 2026-08-31 (reserved); full text drafted 2026-09-11; Approved 2026-09-12  
- **Deciders:** Mission owner (Human)  
- **Supersedes:** none  
- **Recommends superseding:** [ADR-005 — Planning, Subtask, and Assignment (Phase 3a)](./ADR-005-PLANNING-SUBTASK-ASSIGNMENT.md) — see D-007.5. Not automatic; requires the Owner's own approval of that supersession.  
- **Does not replace:** [ADR-006 — AIPOS Control Tower (Governance Enforcement)](./ADR-006-AIPOS-CONTROL-TOWER.md)  
- **Related:** ADR-004 (Know-Me/Hard Control/Tool Chain, Verified); ADR-006 (Control Tower); Architecture Contract; Phase 1 Decisions (D1, D2, D4, D6); Owner Mission Operating Standard Stage 1–6 (this PR); n8n draft prototype `AIPOS — P3 Decompose + Route v0.1` (`xizHBNDiy9W4RLM4`, unpublished)

---

## How to read this document

This is a **draft for Owner review**, written by a coding agent (Claude Code) from what is already built, tested, and verified on `cursor/master-continuity-strategy-169c` (PR #21), plus the locked decisions in `AIPOS_PHASE_1_DECISIONS.md` and the Control Tower authority model. It proposes ratifying architecture that already exists and passes its own tests (D-007.1–D-007.4, D-007.7), and it flags the one piece that is genuinely **not yet decided and must not be inferred** by any agent (D-007.6 — Real Worker Execution scope).

Nothing in this document authorizes further live external writes, Real Worker Execution, or merging PR #21. It authorizes only itself: a text for the Owner to Approve, Approve-with-corrections, or Reject.

---

## Context

`AIPOS-ADR-004` (D6) set the implementation order "Hard first," ending in "Planning → confirm-once → L0–L1 execute + artifacts." ADR-005 (2026-08-03) proposed a Plan/Subtask/Assignment aggregate model for that step, but was never implemented beyond schema-only (see D-007.5). Independently, `cursor/master-continuity-strategy-169c` (PR #21) implemented and verified a materially larger design — Mission Blueprint + Stage Map, Living Capability Registry, Stage Artifact Pipeline, Policy Intelligence, Persistent Mission Navigation, Scope/WIP Control (Stages 1–6, all COMPLETE with evidence docs) — plus a live-verified Linear dispatch adapter (Stage 7A, this session). ADR-006 was deliberately kept as Control Tower / governance enforcement only; this number (007) was reserved on 2026-08-31 to hold the Capability Orchestration decision instead of overloading ADR-006.

This draft closes that reservation with a full text, reconciles it against ADR-005, and separates "already built and verified" from "still requires an Owner decision."

---

## Decision

### D-007.1 — Mission Decomposer behavior and acceptance criteria

**Proposal: ratify as built.** A mission's `mission-strategist.ts` builds a `MissionContextPack` + `MissionStrategy` from confirmed intake content only (no invented facts); `decomposer.ts` selects one of 9 playbooks (`research`, `decision`, `software_build`, `debug`, `automation`, `investigation`, `knowledge_organization`, `business_launch`, `creative_synthesis`, default `investigation`) by heuristic keyword/capability match, and expands it into workstreams carrying `objective`, `required_capabilities`, `risk_level`, `dependencies`, and `acceptance_criteria`. Generic workstream titles (e.g. "understand scope", "do main work") are rejected by `isGenericWorkstreamTitle`. A workstream set is not dispatchable until it is folded into a **persisted, explicitly approved Mission Blueprint** (`mission-blueprint.v1`) — a request-body flag cannot substitute for a stored approval event (already enforced in `control-plane-pipeline.ts`: `BLUEPRINT_APPROVAL_REQUIRED`).

### D-007.2 — Capability routing / operator selection policy

**Proposal: ratify as built.** `capability-registry.ts` is the Living Capability Registry: every capability carries a truth state (`VERIFIED` / `PARTIAL` / `UNVERIFIED` / `UNAVAILABLE` / `REVERIFY_REQUIRED` / `DEGRADED`), computed from `enabled`, `evidence_refs`, `expires_at`, and `last_test_outcome` — a capability cannot read as `VERIFIED` without evidence, and expires back to `REVERIFY_REQUIRED` automatically. `capability-router.ts` matches each workstream's `required_capabilities` against routable capabilities only (`capabilityIsRoutable` excludes every non-routable state) and fails closed to `HUMAN_REQUIRED` the moment any requirement has zero routable operators — it must never distort the task to fit an available operator. Routing mode (`KEEP` / `ASSIST` / `HANDOFF` / `SPLIT` / `HUMAN_REQUIRED`) is derived, not chosen ad hoc.

### D-007.3 — Autonomy classes

**Proposal: formalize the Execution Authorization Envelope already in de facto use** (per `AGENTS.md` and this session's working practice) as ADR-level policy, mapped onto the existing `operational_risk` scale (`L0`–`L4`):

After a Mission Blueprint is approved, an agent **may proceed without a further per-action approval** for: safe discovery/research, reversible `L0`–`L1` actions, decomposition and routing that stays in the Blueprint's declared scope, drafting/testing/verifying/logging, and non-blocking handoff creation.

An agent **must stop and ask the Owner** before: any action needing a credential/connector it does not already hold; any destructive or hard-to-reverse action; production deploy; a financial, legal, or otherwise high-impact decision; an authority conflict (two valid instructions in tension); or a material change to scope, cost, time, architecture, or risk beyond the approved Blueprint. `L3`–`L4` risk actions always route to the Human Gate regardless of an item's "reversible" flag — reversibility lowers cost, it does not raise authority.

This does not change Phase 1 D2 ("confirm plan once → system may auto-run L0–L1"); it makes explicit which categories that clause does and does not cover, closing the ambiguity D-005.9/ADR-005 "Negative / follow-up" section left open.

### D-007.4 — Relationship between the Control Plane (`apps/web`) and execution adapters (n8n, Linear, future adapters)

**Proposal: ratify as built.** AIPOS Core is the sole decision authority: it decides *what* runs and *when* (commands, gates, audit, capability routing), and issues a `correlation_id` as the idempotency key for every dispatch. Adapters (the Linear GraphQL client today; n8n or other adapters later) execute *how* — they perform the external call and return a result; they never decide Mission status, never independently re-plan or re-route, and never gain retroactive authority over a Mission by virtue of having executed part of it. `workstream-dispatcher.ts`'s idempotent search-before-create/fail-closed pattern (verified live in Stage 7A, including the follow-up fix to the search query itself) is the template for every future adapter, not a Linear-specific exception.

**Consequence for the existing n8n prototype:** `AIPOS — P3 Decompose + Route v0.1` (`xizHBNDiy9W4RLM4`, inactive/unpublished) independently implements decompose+route logic that now duplicates `mission-strategist.ts` + `decomposer.ts` + `capability-router.ts` in `apps/web`. Recommend retiring or re-scoping that workflow to a pure execution adapter (accepts a Core-issued job, performs one action, returns a result) rather than running two independent decomposers against the same Mission — a second decomposer is a second source of truth for routing decisions, which Control Tower and this ADR both forbid. This is a recommendation for the Owner to confirm, not an instruction to modify or unpublish that workflow now.

### D-007.5 — Relationship to ADR-005 (Planning, Subtask, and Assignment)

ADR-005 (2026-08-03, still `Proposed (awaiting Human approval)` on this branch) proposed a `Plan` → `Subtask` → `Assignment` aggregate model for the same problem this ADR covers: breaking an approved Mission into trackable, dependency-ordered, human-approvable units of work. On 2026-08-25 a separate Claude Code session, in a different conversation, read a stale AskUserQuestion answer as approval and marked ADR-005 `Approved` **on an orphan branch** (`claude/nitispro-system-dev-08qnvw`, commit `669ded8`) that was never merged; `Plan`/`Subtask`/`Assignment` Zod + JSON Schema contracts were added there (schema-only, never wired to a repository, service, or API route). That branch does not reflect this branch's reality and should not be treated as authoritative.

Meanwhile, `cursor/master-continuity-strategy-169c` independently built and **verified** a different, materially larger model for the same problem — Mission Blueprint + Stage Map (`mission-blueprint.v1`, versioned revisions, explicit approval events, evidence-gated progress) plus the Capability Registry and Workstream Dispatcher above — and it is live-integrated with Stage 7A's real Linear dispatch. Running both models would mean two competing "how is a Mission broken into approvable work" mechanisms — exactly the duplicate-SSOT risk `docs/aipos/CURRENT_STATE.md`'s hard rules and STD-002 both forbid.

**Owner decision (recorded 2026-09-12): Option A — Supersede ADR-005.**

> ADR-007 supersedes ADR-005 in intent. Mission Blueprint, Capability Registry, and Workstream Dispatcher are the new primary architecture. Nothing in ADR-005's substance is lost by not implementing it separately.

**Actions taken on approval:**

1. ✅ ADR-005's Status line updated to `Superseded by ADR-007` (file retained as historical record).
2. **Orphan branch inspection result (read-only, 2026-09-12):** `claude/nitispro-system-dev-08qnvw` (commit `669ded8`) contains unique files **not present in PR #21**: `apps/web/src/lib/schemas/{plan,subtask,assignment}.ts` and corresponding tests, `packages/schemas/{plan,subtask,assignment}.schema.json`. These are schema-only (never wired to any repository, service, or API route). They are superseded in intent by Mission Blueprint + Capability Registry. The branch is marked for closure without merge. **Branch not deleted yet** — Owner has confirmed it may be closed; deletion awaits explicit Owner directive.
3. ✅ Orphan branch `claude/nitispro-system-dev-08qnvw` is designated for closure without merge. No code from it is needed.

If the Owner later decides to retain Plan/Subtask/Assignment as a lighter-weight path alongside Blueprint, that requires a new ADR decision, not a reversal of this one.

### D-007.6 — Real Worker Execution scope (Stage 7B)

**Owner decision (recorded 2026-09-12): Option B — AI worker operators, L0–L1 only, Stage 7B proof scope.**

> "อนุญาต AI worker operators เฉพาะระดับ L0–L1 สำหรับ Stage 7B proof เท่านั้น"

**Authorized scope for Stage 7B:**
- AI workers (e.g. Claude Code acting as `worker:*`) may perform drafting, research, documentation, non-destructive code changes — L0–L1 only.
- All external writes (Linear, Notion, database) must go through the existing adapter dispatch path (D-007.4); AI workers are **not** a bypass around that path.
- Every write must carry: `idempotency_key`, `readback_verification`, `audit_evidence`, and a `rollback_recovery_path`.

**Explicit forbidden-actions list (binding; no agent may override):**
1. ❌ Writing to Linear, Notion, or any database **directly** — must use authorized adapters with idempotency and readback
2. ❌ Modifying secrets, credentials, or environment variables
3. ❌ Production deploy of any kind
4. ❌ Financial transactions or legally-binding operations
5. ❌ Merging PRs (automated or otherwise)
6. ❌ Touching or re-implementing Phase 1–2 intake baseline
7. ❌ Counting a simulation, mock, or stub as evidence of Real Worker success
8. ❌ Re-running `npm run linear:e2e` — NIT-22 already exists from Stage 7A; duplicate dispatch would violate idempotency semantics

**Stage 7B is authorized** to implement one reversible, idempotent L0–L1 Real Worker proof task, subject to the above constraints and D-007.3's Human Gate rules.

| Axis | Value |
|---|---|
| What executes | Adapters + L0–L1 AI worker operators under Operator Contract |
| Risk ceiling | L0–L1 only (drafting, research, documentation, non-destructive changes) |
| External writes | Via authorized adapter dispatch only — never direct |
| Proof task | One reversible, idempotent task; must produce audit evidence and readback |

### D-007.7 — Phase 3 routing gate

Reaffirmed: Phase 3 dispatcher/router **expansion** beyond what Stage 0–7A already implements on this PR remains gated until this ADR is Approved (or Approved-with-corrections). The Decomposer and Router already exist and are verified (Stage 1–6 COMPLETE, Stage 7A Real Linear E2E PASS) — the gate was never about code readiness; it is about the Owner explicitly authorizing Capability Orchestration as the system's architecture, and in particular deciding D-007.5 and D-007.6, which no agent can decide unilaterally.

---

## Consequences

### Positive

- Closes the ADR-006/ADR-007 number-reservation ambiguity with a single coherent text instead of two partially-overlapping ADRs
- Resolves the ADR-005-vs-Blueprint duplication risk explicitly, with a recorded reason, instead of leaving two designs live
- Gives Real Worker Execution (Stage 7B) a decision table instead of leaving its scope to be inferred by whichever agent gets there next
- Retroactively documents autonomy classes (D-007.3) that were already being applied ad hoc, making them auditable

### Negative / follow-up

- If the Owner rejects D-007.5's supersession recommendation, ADR-005 needs its own explicit disposition (revive and implement, or formally withdraw) rather than sitting `Proposed` indefinitely
- D-007.6 remains a hard stop until the Owner completes it — this ADR being Approved does **not** implicitly resolve D-007.6
- The n8n prototype re-scoping in D-007.4 needs its own follow-up once confirmed (workflow edit is out of scope for this docs change)

### Forbidden without a further ADR

- Collapsing Mission Blueprint stages and Capability Registry entries into a single object
- Giving n8n (or any adapter) Mission decision authority
- Treating D-007.6 as resolved by anything other than an explicit Owner answer recorded in this file

---

## Compliance checklist (for implementers)

- [x] No source code changed in the initial docs commit
- [x] Owner has recorded a decision on D-007.5 (ADR-005 disposition) — **Option A: Supersede**
- [x] Owner has recorded a decision on D-007.6 (Real Worker Execution scope) — **Option B: L0–L1 AI workers, Stage 7B proof only**
- [x] ADR-005 Status updated to `Superseded by ADR-007`
- [x] `docs/aipos/CURRENT_STATE.md` / `SYSTEM_UNDERSTANDING_NITISPRO.md` to be updated in this commit

---

## Existing prototype (read-only reference)

| Item | Value |
|---|---|
| Name | AIPOS — P3 Decompose + Route v0.1 |
| n8n workflow ID | `xizHBNDiy9W4RLM4` |
| Active | **false** (unpublished draft) |
| Notes | Heuristic decompose + route; separate from frozen intake; cites ADR-006 historically — future revisions must cite **ADR-007**; see D-007.4 for the recommended re-scoping |

---

## Operational SoT pointer

Production Phase 1–2 status (do not duplicate as a second CURRENT STATE doc):

- Notion: [AIPOS CURRENT STATE](https://app.notion.com/p/3cdbc165be4c81c48e73e5899ae5f0e3)

---

## Approval

| Role | Decision | Date |
|---|---|---|
| Mission owner (Human) | **Approved** — D-007.5: Option A (Supersede ADR-005); D-007.6: Option B (L0–L1 AI workers, Stage 7B proof only) with explicit forbidden-actions list as stated | 2026-09-12 |
