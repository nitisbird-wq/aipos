# Risk Register — Intake MVP

| ID | Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|---|
| R1 | Notion latency/outage blocks UX | M | M | App DB is source for runtime; async sync + retry; never block Mission create on Notion if policy allows create-then-sync (MVP: create Mission then sync; show failed clearly) |
| R2 | Sensitive data logged | M | H | Redaction middleware; field allow-lists |
| R3 | Scope creep into specialist execution | H | H | Scope doc + CI grep for forbidden SDK imports optional |
| R4 | Duplicate missions from retries | M | M | idempotency_key unique |
| R5 | Direct status mutation by mistake | M | H | No PATCH status route; transition service only |
| R6 | ChatGPT channel confusion | M | L | Document web_app first; Phase 0.2 Actions |
| R7 | Domain auto-route of police/legal | L | H | Seed unvalidated + auto_route_enabled=false |
| R8 | Secrets in repo | L | H | .gitignore + .env.example only |
| R9 | Analyze stub low quality | H | M | Explicit “heuristic analysis” label; optional LLM later |
| R10 | Vercel + wrong DB choice | M | H | Postgres not SQLite |

## Residual

Operator must still review understanding before confirm — product depends on human authority for Mission creation.
