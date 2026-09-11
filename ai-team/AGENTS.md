# ai-team/AGENTS.md — Orchestration rules for this subsystem

Scope: this file governs work **inside `ai-team/` only**. Root `AGENTS.md` (secrets, scope, ownership)
still applies everywhere in this repo. Mission-Intake-specific gates (Control Tower / ADR-006, Notion
Mission Registry, the frozen production n8n workflow) do **not** apply here — this subsystem doesn't
touch any of that. See `ai-team/README.md` → "ความสัมพันธ์กับ AIPOS หลัก" before connecting the two.

## The orchestrator pattern ("Claudy")

The root Claude Code session working in this repo acts as the orchestrator. Whoever drives that
session — the user, or Claude Code itself when given a mission-level instruction — routes tasks to the
subagents below. **The orchestrator does not do research, write copy, critique, or fact-check itself**
— that's what the subagents are for. If you catch yourself doing a subagent's job inline, stop and
delegate instead.

Default pipeline for a new content/research task:

```
minnie-idea-cards → reese-researcher → (chris-critic + vera-fact-auditor, both must PASS)
→ librarian → rae-writer → chris-critic (final script review) → mark Published on pipeline/board.md
```

A `REVISE` verdict from either chris-critic or vera-fact-auditor sends the doc back to
reese-researcher with their notes attached — it does not go to the librarian until both pass.

## Knowledge loop

- Only `librarian` writes to `knowledge-base/insights/` and `knowledge-base/theses/`.
- Before handing a topic to `reese-researcher`, the orchestrator should pull any existing insights/
  theses on that topic from `knowledge-base/` and hand them over — this is how memory "feeds back"
  into every new research cycle instead of starting cold each time.
- A new finding that contradicts something already in the knowledge base goes into
  `knowledge-base/contradiction-registry.md` — it is never silently overwritten.

## Standalone agents

`nick-portfolio-reviewer` and `dale-analytics` are not part of the pipeline above. They run on demand,
whenever the user has a portfolio or an analytics export to review, and produce a one-off read rather
than a pipeline artifact.

## Boundaries

- Do not create a real database, real Notion integration, or a real scheduled job for anything in this
  folder without checking with the user first — that would be scope expansion beyond what's been
  agreed (see root `AGENTS.md`, "No silent scope expansion").
- Do not reference or modify anything under `apps/web`, `adr/`, `docs/` (the governed AIPOS docs), or
  the production n8n workflow from work done in this folder.
- If a subagent needs a tool or source it doesn't have (e.g. a real SEC EDGAR fetch), say so and leave
  a note in `research/sources.md` rather than improvising a workaround that isn't visible to the user.
