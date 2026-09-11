# Knowledge base

This is the memory that feeds every future research cycle — mirrors the "memory feeds back" loop in
the LTD OS diagram. Before starting new research on a topic, the orchestrator should hand
`reese-researcher` whatever already exists here for that topic.

- `insights/` — atomic, source-backed insights, one file per topic. Only `librarian` writes here.
- `theses/` — standing positions per topic. Superseded (append a dated update), never silently deleted.
- `contradiction-registry.md` — anywhere a new finding conflicts with something already logged here.
- `decisions-log.md` — one line per change: what changed in the KB and why.

## Rules

- Only `librarian` writes to `insights/` and `theses/`. Everyone else reads.
- An insight is one claim, source-backed, with a date — not a paragraph summary.
- A contradiction is never resolved by quietly picking a winner; both entries stay, flagged, until a
  human (or a later research pass with better evidence) resolves it explicitly.
