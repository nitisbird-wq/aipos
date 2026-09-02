# AIPOS Owner Mission Operating Standard

- **Standard ID:** AIPOS-STD-003
- **Version:** 0.1
- **Status:** APPROVED REQUIREMENT / IMPLEMENTATION PENDING
- **Owner:** Nitis
- **Applies to:** Nitis Pro mission intake, planning, routing, execution, handoff, verification, and follow-up
- **Canonical relationship:** Extends AIPOS-STD-002 and the existing architecture contract. It does not create a second runtime source of truth.

## 1. Final outcome before task decomposition

Mission Intake must define the complete desired end state and Definition of Done before creating tasks.

The Blueprint must expose:

- objective and desired outcome;
- scope in / scope out;
- numbered stages from START to DONE;
- outputs, dependencies, owner/executor, entry and exit criteria for every stage;
- critical path and remaining stages;
- risks, assumptions, missing information, costs/resources, and constraints;
- acceptance criteria and required evidence;
- recommendations, alternatives, challenge points, and parked ideas.

The Owner can edit, add, remove, merge, split, reorder, or return the Blueprint for analysis. No create/dispatch occurs before explicit Blueprint approval.

## 2. Mission Intake dialogue states

Required additive orchestration states:

1. RECEIVED
2. DISCOVERING
3. IDEATING
4. OUTCOME_DEFINED
5. BLUEPRINT_REVIEW
6. APPROVED
7. DISPATCHED
8. IN_PROGRESS
9. HANDOFF
10. VERIFYING
11. COMPLETED

Exceptional states:

- WAITING_OWNER
- BLOCKED
- RECONCILING
- FAILED
- CANCELLED

These states map to, but do not replace, the frozen intake and mission state machines.

## 3. Execution Authorization Envelope

After Blueprint approval, the system continues without repeated routine questions for:

- safe discovery;
- reversible L0-L1 work;
- approved in-scope task decomposition;
- drafting, testing, verification, logging, and routine repair;
- non-blocking handoffs between approved stages.

Pause only for credentials/connector permission, destructive or hard-to-reverse actions, production deployment, financial/legal/high-impact decisions, unresolved authority conflict, or material scope/cost/time/architecture/risk change.

## 4. Capability Truth Gate

Before promising work or selecting an executor, the system verifies:

- input access;
- model/tool/skill capability;
- required fonts/assets/formats;
- connection and permission state;
- ability to inspect or render the final output;
- task-specific quality threshold.

Allowed capability states:

- VERIFIED
- PARTIAL
- UNVERIFIED
- UNAVAILABLE
- REVERIFY_REQUIRED
- DEGRADED

Do not claim exact delivery, visual fidelity, font correctness, identity preservation, or complete inspection without current evidence.

## 5. Living Capability Registry

Each AI, agent, human role, tool, skill, or connector has a versioned Capability Card:

- identity and version;
- supported task types;
- verified capabilities and limitations;
- required inputs/connections/permissions;
- prohibited claims;
- supported output formats;
- render/inspection ability;
- quality thresholds and Golden Task evidence;
- tested_at, tested_by, confidence, expiry/review date;
- fallback and escalation path.

Separate limitations into:

1. intrinsic model limitation;
2. tool/runtime limitation;
3. connection/permission limitation;
4. task-specific quality limitation.

A model/tool/skill/connector change sets affected cards to REVERIFY_REQUIRED. New results supersede prior routing evidence while preserving history. Real failures downgrade capability immediately.

## 6. Best-Fit Assignment Gate

Before dispatch, compare eligible executors using verified task fit, quality, access, risk, cost, speed, continuity, and inspection ability.

Explain one of:

- KEEP
- ASSIST
- HANDOFF
- SPLIT
- HUMAN_REQUIRED

If another executor is materially better, tell the Owner before work fails. Do not accept silently and experiment at the Owner's expense. High-risk work should use separate maker and checker when available.

## 7. Stage Artifact Contract

When a stage passes its exit criteria, freeze a distinct stage snapshot containing:

- source inputs;
- editable working file;
- final stage output;
- preview/render where applicable;
- summary, decisions, assumptions, and limitations;
- producer and reviewer;
- verification and evidence;
- timestamps, version, lineage, and stable identifier.

Register it in the Artifact Ledger, then hand off to the next stage immediately inside the authorization envelope. Never overwrite accepted artifacts. Revisions declare which version they supersede. Failed attempts and evidence remain traceable but are not handed off as accepted work.

The Owner must be able to open, download, compare, and roll back to every stage artifact.

## 8. Render Verification Gate

For DOCX, PDF, PPTX, image, and other visual artifacts:

- render every page or material frame;
- check Thai fonts, overflow, clipping, pagination, spacing, missing or distorted media;
- apply identity/face lock when required;
- compare the rendered artifact with the approved Blueprint;
- repair and re-render until the acceptance criteria pass.

Creating a file is not completion.

## 9. Persistent Mission State and follow-up

Each Mission and Stage records:

- status and evidence-based progress;
- current stage and total stages;
- current owner/executor;
- checkpoint and completed outputs;
- next executable action;
- blockers, dependencies, and waiting-on;
- due/review date, last activity, and stale threshold;
- retry/resume data;
- final Definition of Done.

Resume must be idempotent and must not repeat completed work. Every return to a mission reports CURRENT STATE / DONE / IN PROGRESS / BLOCKED / NEXT.

## 10. Primary Mission Anchor and interruption recovery

Each workspace/session has an active primary mission with objective, checkpoint, next action, and Definition of Done.

New input is classified as:

- RELATED_IDEA
- SUBTASK
- URGENT_INTERRUPTION
- NEW_MISSION

Before switching, checkpoint the primary mission and push it onto the interruption stack. When the interruption is completed, parked, blocked, or cancelled, automatically summarize it and return the Owner to the primary mission's next executable action. Never silently replace the primary mission.

## 11. Idea governance, Scope Guard, and WIP limit

Classify each new idea as:

- MUST_NOW — required for Definition of Done or safety;
- SHOULD_NEXT — useful after the primary mission closes;
- LATER — retain with value, trigger, owner, and review date;
- REJECT — duplicate, low value, harmful, or off-strategy.

Prefer finish-before-expand. Do not accept every idea into active scope. A material scope/cost/time/risk/architecture change requires trade-off disclosure and Blueprint re-approval. Limit concurrent work and recommend one next action.

## 12. Policy Inbox and consolidation

Connected AI/chat/channel inputs that may be a POLICY, REQUIREMENT, PREFERENCE, CORRECTION, IDEA, or DECISION enter the Policy Inbox with provenance, source/session reference, scope, priority, confidence, effective/review date, and proposed canonical target.

Before promotion:

- deduplicate;
- detect conflict;
- identify supersedes relationships;
- request Owner review when materially ambiguous;
- map to Owner Constitution, Operating DNA, Domain Playbook, Project Policy, or learned preference.

Never claim cross-chat coverage for chats or systems that are not connected or ingested.

## 13. Guided unblocking

When blocked, state:

1. CAN / PARTIAL / CANNOT;
2. exact reason and evidence;
3. affected stages;
4. safe work that can continue;
5. recommended workaround;
6. exact Owner action, UI path, and verified direct link when available;
7. secret/credential warning;
8. verification after Owner action;
9. automatic resume from checkpoint.

## 14. Owner dashboard requirements

The Mission view must answer immediately:

- What is the final outcome?
- Which stage are we on, out of how many?
- What is complete and where are its artifacts?
- What is active, blocked, or waiting?
- What remains on the critical path?
- What is the current completion forecast and its assumptions?
- Which ideas are NOW, NEXT, LATER, or REJECT?
- What is the single next executable action?

Progress percentages must be evidence-based, never invented.

## 15. Continuous team development

After execution, capture task-type outcomes, verification results, rework, failure/near-miss, Owner feedback, strengths, gaps, training/tool/skill opportunities, and retest dates. Use multiple observations and evidence; do not permanently judge capability from one event.

## 16. PR #21 scope decision

### Required before PR #21 Ready/Merge

- Preserve Phase 1-2 frozen behavior.
- Map existing orchestration states to the intake dialogue states without changing frozen semantic locks.
- Add this standard to architecture and acceptance review.
- Demonstrate that handoff/checkpoint/artifact data can support stage continuity.
- Demonstrate capability routing fails closed and does not claim unverified capability.
- Add acceptance cases for Blueprint-before-dispatch, primary-mission continuity, and evidence-based completion language.
- Report unsupported requirements explicitly; do not label them implemented.

### Follow-up implementation phases

1. **Mission Blueprint & Stage Map:** editable Blueprint, revisions, stage evidence, progress.
2. **Capability & Team Intelligence:** living registry, expiry/retest, best-fit scoring.
3. **Artifact Pipeline:** immutable stage artifacts, lineage, render verification.
4. **Policy Intelligence:** Policy Inbox, provenance, consolidation, cross-channel coverage.
5. **Mission Navigation:** primary anchor, interruption stack, resume and stale supervisor.
6. **Scope Control:** WIP limits, NOW/NEXT/LATER/REJECT, forecast and trade-off gates.
7. **Live integrations:** Linear E2E, worker execution, n8n, production gates.

## 17. Acceptance principle

A feature is not SHIPPED because a schema, document, mock, or unit test exists. It is SHIPPED only when the intended runtime behavior is implemented, verified with representative evidence, visible to the Owner where required, and safely recoverable.
