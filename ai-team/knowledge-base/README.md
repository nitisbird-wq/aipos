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

## Knowledge Admission Contract

Every entry `librarian` writes to `insights/` or `theses/` must carry all of these fields — an entry
missing any of them isn't admitted yet, it's a draft:

| Field | What it is |
|---|---|
| Claim | The one atomic statement (insight) or standing position (thesis) |
| Source | Where it came from — URL, document, or file in `research/sources.md` |
| Source date | When the source itself was published/dated |
| Ingestion date | When `librarian` filed this entry |
| Confidence | `vera-fact-auditor`'s verified / couldn't-verify read on this specific claim |
| Reviewer | Which agents signed off (`chris-critic`, `vera-fact-auditor`) and their verdicts |
| Data classification | `PUBLIC` or `INTERNAL` only — see `README.md` → "Sandbox Charter" → Data
  Classification Gate. `librarian` must refuse to file `CONFIDENTIAL`/`RESTRICTED` material here. |
| Provenance | Which research doc / run produced this (link back to `research/output/`) |
| Review/expiry date | When this should be re-checked, if the claim is time-sensitive |

This is deliberately stricter than a normal note — the whole point of this KB is that later research
can trust what's in it without re-verifying from scratch. An entry without provenance defeats that.
