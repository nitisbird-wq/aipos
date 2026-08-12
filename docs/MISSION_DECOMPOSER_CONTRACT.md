# Mission Decomposer Contract (ADR-006.v2)

**Status:** Design contract — implementable; Router/Dispatcher **HELD**  
**Supersedes:** generic “understand scope → create main output” heuristic  
**Frozen:** Phase 1–2 intake workflow `760150d8-2e1a-4a5e-93a9-48781c306583` (do not modify)  
**Schemas:** `packages/schemas/workstream-plan.schema.json` (`decomposer_version: ADR-006.v2`), `workstream.schema.json`

---

## 1. Purpose

Convert one confirmed, Phase-2-dispatched Mission into a **variable-length DAG of concrete Workstreams** that:

- reflect the **actual mission domain**
- produce the **actual requested deliverable**
- ask the Owner **only** for true blockers (never for safely inferable details)

Phase 1 CONFIRM remains the only Mission approval. Decomposition is **not** a second approval product.

---

## 2. Derivation pipeline (mandatory order)

```text
1. Mission objective          (what change is sought)
2. Desired outcome            (end-state the Owner will accept)
3. Success criteria           (testable checks)
4. Domain                     (business | software | automation | research |
                               ops | knowledge | decision | mixed | …)
5. Required reasoning/actions (verbs + artifacts needed — NOT operators yet)
6. Dependencies               (which actions need whose outputs)
7. Final deliverable          (single integration target when needed)
8. THEN required_capabilities (derived from each workstream’s work)
9. Operators                  (HELD — Router later; leave unassigned here)
```

**Forbidden reverse order:** do not pick Claude/Cursor/n8n first and invent workstreams to match.

---

## 3. Decomposition rules

| Rule | Requirement |
|---|---|
| **R1 Variable count** | No fixed N. Count follows real action boundaries. |
| **R2 No generic placeholders** | Ban titles like “Understand scope”, “Create main output”, “Do the work” unless the Mission itself is literally that vague *and* still needs a clarifying workstream. |
| **R3 Infer, don’t interrogate** | Safe inferences → `explicit_assumptions[]`. Only true blockers → `owner_questions[]`. |
| **R4 Concrete WS** | Every workstream has: concrete `objective`, `expected_output`, `acceptance_criteria[]`, `dependencies[]`, and (after work defined) `required_capabilities[]`. |
| **R5 Capabilities after work** | Attach capabilities only once the workstream’s objective/output/criteria exist. |
| **R6 Integrate when needed** | If multiple upstream artifacts must become one Owner-facing deliverable, the **last** workstream integrates them into that deliverable. Skip integration WS when a single WS already *is* the deliverable. |
| **R7 Domain fidelity** | Workstream language must match domain (e.g. competitor matrix ≠ “draft briefing outline”). |
| **R8 DAG** | Dependencies acyclic; parallel only when no edge. |
| **R9 Operators deferred** | Decomposer sets `primary_operator: unassigned` (Router HELD). |

---

## 4. Revised output contract

### 4.1 Mission understanding (plan header)

| Field | Meaning |
|---|---|
| `mission_objective` | Restated objective |
| `desired_outcome` | End-state |
| `success_criteria` | From Mission / refined |
| `domain` | Primary domain label |
| `domain_signals` | Short evidence for domain choice |
| `final_deliverable` | Exact artifact the Owner receives |
| `explicit_assumptions` | Inferred, labeled assumptions (not questions) |
| `owner_questions` | Only genuine blockers; usually empty |
| `reasoning_actions` | Ordered list of domain actions before packaging into WS |
| `integration_required` | bool — whether a final integrate WS is needed |

### 4.2 Workstream (decompose-time)

| Field | Required | Notes |
|---|---|---|
| `workstream_id` | yes | `WS-MIS-{n}-{nn}` |
| `title` | yes | Domain-specific, non-generic |
| `objective` | yes | Concrete |
| `expected_output` | yes | `{ type, description, location_hint? }` |
| `acceptance_criteria` | yes | ≥1 testable |
| `dependencies` | yes | `[]` or prior WS ids |
| `required_capabilities` | yes | Derived **after** objective/output/criteria |
| `reasoning_action_refs` | yes | Indices/ids into `reasoning_actions` |
| `is_integration_workstream` | yes | true only for final integrator |
| `inputs` | yes | What upstream artifacts it consumes |
| `risk_level` | yes | Per-WS; may differ from mission |
| `primary_operator` | yes | **`unassigned` until Router** |
| `supporting_operator` | yes | `null` until Router |
| `approval_required` / `status` | yes | Per ADR-006 risk policy later; decompose may leave `proposed` |

---

## 5. Anti-patterns (reject)

- Single WS: “Complete the mission”
- Always exactly 3 workstreams
- Capability-first: “Claude research → Cursor code → Notion write” without domain actions
- Asking Owner for tone/format/priority order when defaults can be assumed and listed
- Integration WS that restates “create main output” without naming the deliverable
- Software missions decomposed as “write briefing”
- Research missions decomposed as “implement feature”

---

## 6. Example suite (contract tests)

Examples below are **decomposition-only**. Operators stay `unassigned`. Capabilities appear only after each WS’s work is defined.

### Example A — Business research / competitor analysis

**Mission:** Compare three local café competitors’ pricing, menu positioning, and Instagram presence; produce a one-page recommendation for SAHAKON’s next 30-day promo.

| Step | Content |
|---|---|
| Objective | Competitive promo insight for SAHAKON |
| Desired outcome | Owner can choose one promo angle with evidence |
| Success criteria | 3 competitors covered; pricing+menu+IG compared; 1 recommended angle + 2 risks |
| Domain | `business_research` |
| Final deliverable | One-page competitor recommendation memo |
| Assumptions | Competitors = top 3 nearby cafés by foot traffic; IG = public posts last 30 days; Thai+EN ok |
| Owner questions | _(none)_ |

**Reasoning/actions → Workstreams**

| WS | Objective | Expected output | Depends | Capabilities (after) |
|---|---|---|---|---|
| 01 Collect competitor facts | Gather pricing, menu themes, IG cadence for 3 cafés | Structured fact table | — | `research.synthesize` |
| 02 Build comparison matrix | Score positioning vs SAHAKON | Comparison matrix | 01 | `strategy.analyze` |
| 03 Recommend 30-day promo | Pick angle + risks from matrix | One-page memo (final) | 02 | `docs.write`, `strategy.analyze` |

Integration: **WS-03 is the deliverable** (no extra integrator).

---

### Example B — Software feature

**Mission:** Add a “Mission risk badge” on the AIPOS web Mission detail page showing L0–L4 from mission data; include unit test; open a PR.

| Domain | `software` |
| Final deliverable | GitHub PR with UI badge + test |
| Assumptions | Use existing Mission object `operational_risk`; match current UI tokens; no schema rename |

| WS | Objective | Output | Deps | Caps |
|---|---|---|---|---|
| 01 Locate Mission detail UI + data path | Identify component + risk field wiring | Short tech note (paths) | — | `architecture.analyze` |
| 02 Implement risk badge UI | Badge renders L0–L4 on detail page | Code change | 01 | `code.implement` |
| 03 Add unit test for badge mapping | Test covers enum→label/color | Test file | 02 | `code.test` |
| 04 Open PR with DoD checklist | PR links Mission + screenshots/notes | PR (final) | 02, 03 | `code.implement` |

Integration: **WS-04** packages code+test into the PR deliverable.

---

### Example C — n8n automation

**Mission:** Every weekday 09:00 Asia/Bangkok, post a Notion Mission Registry count of `Dispatch Status = Not Dispatched` to a Slack channel (ops hygiene).

| Domain | `automation` |
| Final deliverable | Published n8n schedule workflow + Slack message sample |
| Assumptions | Use existing Notion Mission Registry; Slack channel = ops default; L1 reversible |

| WS | Objective | Output | Deps | Caps |
|---|---|---|---|---|
| 01 Specify query + message schema | Count filter + Slack payload contract | Spec note | — | `workflow.design` |
| 02 Build n8n schedule→Notion→Slack flow | Working draft workflow | n8n draft | 01 | `automation.flow` |
| 03 Dry-run + sample message evidence | One test execution artifact | Execution log + sample | 02 | `automation.flow` |
| 04 Publish with Human gate note | Publish only after approval flag | Published workflow (final) | 03 | `automation.flow` |

WS-04 is consequential publish → `approval_required` later via risk policy (not decompose-time Owner Q&A).

---

### Example D — Debugging

**Mission:** Vitest fails on `risk-autonomy.test.ts` in CI; find root cause and fix without changing ADR-006 policy meaning.

| Domain | `software_debug` |
| Final deliverable | Fix commit/PR + failing→passing evidence |

| WS | Objective | Output | Deps | Caps |
|---|---|---|---|---|
| 01 Reproduce failure locally | Capture failing assertion | Failure log | — | `code.debug` |
| 02 Isolate root cause | Causal note (test vs impl) | RCA note | 01 | `code.debug` |
| 03 Apply minimal fix | Green suite | Code fix | 02 | `code.implement` |
| 04 Verify CI-equivalent command | Pass log for orchestration tests | Verification log (final) | 03 | `code.test` |

---

### Example E — Executive reporting

**Mission:** One-page Monday briefing of top 3 operator priorities from a provided open-work list (MIS-3 style).

| Domain | `executive_reporting` |
| Final deliverable | One-page briefing note |
| Assumptions | Priority order by operational urgency if unspecified; plain text ok |

| WS | Objective | Output | Deps | Caps |
|---|---|---|---|---|
| 01 Rank three open-work items | Ordered top-3 with rationale seeds | Ranked list | — | `strategy.analyze` |
| 02 Draft one-page briefing | Briefing with rationale + next action each | Briefing draft | 01 | `docs.write` |
| 03 Tighten to &lt;5 minute read | Final briefing (final) | Final note | 02 | `docs.write` |

---

### Example F — Knowledge organization

**Mission:** Reorganize AIPOS Knowledge Registry tags for “Mission Intake” vs “Capability Orchestration” so search separates Phase 1–2 from Phase 3 docs.

| Domain | `knowledge` |
| Final deliverable | Updated Notion Knowledge entries + short change log |

| WS | Objective | Output | Deps | Caps |
|---|---|---|---|---|
| 01 Inventory current tagged pages | Inventory table | Inventory | — | `knowledge.manage` |
| 02 Propose tag taxonomy | Taxonomy proposal | Taxonomy | 01 | `knowledge.manage` |
| 03 Apply tags + write change log | Updated pages + log (final) | Change log | 02 | `knowledge.manage` |

---

### Example G — Decision preparation (Human at end)

**Mission:** Prepare a go/no-go brief for enabling Postgres in a non-prod AIPOS environment (cost, risk, rollback).

| Domain | `decision` |
| Final deliverable | Go/no-go decision brief for Owner |
| Assumptions | Non-prod only; no production cutover in this Mission |

| WS | Objective | Output | Deps | Caps |
|---|---|---|---|---|
| 01 Gather constraints (env, cost, rollback) | Constraint sheet | Sheet | — | `research.synthesize` |
| 02 Frame options + risks | Options matrix | Matrix | 01 | `strategy.analyze` |
| 03 Write go/no-go brief | Decision brief (final) | Brief | 02 | `docs.write`, `decision.prepare` |

Owner decision is **after** deliverable — not a decomposer question.

---

### Example H — Ambiguous / unsafe

**H1 Ambiguous:** “Make things better.”  
→ Domain `unknown`. Workstreams: **one** clarifying WS with concrete questions (only case where “clarify” is allowed). No fake research/code WS. `owner_questions` populated.

**H2 Unsafe:** “Export real police case files to a public GPT.”  
→ Domain `domain.police` + handling block. Workstreams: **refuse / escalate** WS only; no collection WS. Capabilities: none executable; Human.

---

### Example I — Mixed Claude+Cursor (research → implement)

**Mission:** Research how Linear parent/child issues should encode `AIPOS_WORKSTREAM_ID`, then implement a markdown template doc in-repo for Dispatcher (doc only, no Dispatcher code yet).

| Domain | `mixed_research_software` |
| Final deliverable | In-repo template markdown + short design note |

| WS | Objective | Output | Deps | Caps |
|---|---|---|---|---|
| 01 Research Linear relation patterns + token rules | Design note | Note | — | `research.synthesize`, `architecture.analyze` |
| 02 Author repo template markdown | `docs/…` template file | Doc | 01 | `docs.write` / `code.implement` (repo edit) |
| 03 Integrate note+template as deliverable pack | Linked pack (final) | Pack | 01, 02 | `docs.write` |

---

### Example J — Dependency-heavy multi-system

**Mission:** Design then document (not publish) an n8n→Linear child-issue Dispatcher contract that reuses Phase 2 reconcile; include sequence diagram and failure modes.

| Domain | `architecture` |
| Final deliverable | Dispatcher design doc with diagram + failure table |

| WS | Objective | Output | Deps | Caps |
|---|---|---|---|---|
| 01 Extract Phase 2 reconcile invariants | Invariant list | List | — | `architecture.analyze` |
| 02 Draft child-issue create sequence | Sequence diagram | Diagram | 01 | `architecture.analyze` |
| 03 Enumerate failure modes + fail-closed behavior | Failure table | Table | 01, 02 | `architecture.analyze` |
| 04 Integrate into single design doc | Design doc (final) | Doc | 02, 03 | `docs.write` |

---

## 7. Quality bar before Router

Decomposer is ready for implementation only when:

1. ≥ these example classes pass manual/contract review without generic WS  
2. Schema `ADR-006.v2` validates fixtures  
3. DAG check passes  
4. Capabilities never appear before objective/output/criteria in the authoring order  
5. Frozen intake workflow untouched  

**Router / Dispatcher remain HELD.**

---

## 8. Relation to prior heuristic

n8n draft `AIPOS — P3 Decompose + Route v0.1` (`xizHBNDiy9W4RLM4`) used capability-keyword heuristics and a single generic execute WS — **non-compliant** with this contract. Do not use it as the decomposition authority. Replace or rewrite only after this contract is accepted; still do not touch frozen intake.
