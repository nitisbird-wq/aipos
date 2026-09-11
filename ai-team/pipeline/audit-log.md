# Audit log

One row per real pipeline run (not chat exploration) — see `README.md` → "Sandbox Charter" → Audit
Trail and `AGENTS.md` → "Governance hardening". The orchestrator fills this in as a run progresses,
not all at once at the end — if a run stops partway (revise loop cap, kill switch, user interrupt),
the row should still show how far it got.

Run ID format: `<YYYY-MM-DD>-<slug>-<NN>` (`NN` increments if the same topic runs more than once in a
day).

| Run ID | Input | Orchestrator decision | Agents called (in order) | Artifacts | Critic verdict | Fact-audit verdict | KB mutations | Final output | Stopped early? |
|---|---|---|---|---|---|---|---|---|---|
| _(example — delete when a real run exists)_ | | | | | | | | | |
