# Pipeline board

Stages: `Idea` → `Research` → `Script` → `Record` → `Edit` → `Review` → `Published` → `Archived`

The orchestrator updates a row's stage after each handoff completes. Subagents themselves only touch
files under `research/output/`, `knowledge-base/`, and `content/library/` — they don't edit this board.

| Title | Type | Stage | Target date | Notes |
|---|---|---|---|---|
| _(example — delete when real rows exist)_ | content | Idea | — | — |
