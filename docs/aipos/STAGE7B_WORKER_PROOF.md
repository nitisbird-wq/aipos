# Stage 7B Real Worker Proof — Evidence Record

## Authorization

- **ADR-007 §D-007.6** — Approved by Owner 2026-09-12
- **Decision:** Option B — AI worker operators, L0–L1 only, Stage 7B proof scope
- **Forbidden-actions list:** as recorded in ADR-007 §D-007.6 (binding)

## Proof scope

One reversible, idempotent, L0 research worker task:
- No external writes (no Linear / Notion / DB direct calls)
- All state via control-plane state adapter (`upsertMissionControlState`)
- Fully reversible: deleting the mission's control-plane state removes all artifacts
- Idempotent: same `idempotency_key` → same `artifact_uri`, no second write

## Implementation

| File | Purpose |
|---|---|
| `apps/web/src/lib/services/worker-proof.ts` | L0 research worker — generates structured artifact, idempotency, readback, audit trail, builds Handoff |
| `apps/web/src/lib/services/worker-proof.test.ts` | 7 unit tests — all pass |

## Test evidence (2026-09-12)

```
Test Files  31 passed (31)
     Tests  131 passed | 7 skipped (138)
```

Worker-proof specific tests:

| Test | Result |
|---|---|
| generates a research artifact on first run | ✅ PASS |
| returns idempotent_reuse=true on second call | ✅ PASS |
| produces a handoff that passes the verifier evaluator | ✅ PASS |
| enforces L0 authority even if package requests higher level | ✅ PASS |
| artifact URI is deterministic for the same inputs | ✅ PASS |
| handoff status is PASS with no external writes | ✅ PASS |
| audit trail records all steps including readback | ✅ PASS |

## Evidence properties verified

| Property | Status |
|---|---|
| `idempotent_reuse=true` on second call | ✅ verified by test |
| `readback_matched=true` after write | ✅ verified by test |
| Authority level enforced at L0 (even if package says L3) | ✅ verified by test |
| Handoff passes `evaluateHandoffVerification()` | ✅ verified by test |
| All evidence `status="app_persisted"` (no `external_verified`) | ✅ verified by test |
| No external writes in any code path | ✅ structural — no Linear/Notion/DB import |
| Audit trail complete (start → authority_check → generate → persisted → readback → done) | ✅ verified by test |

## What this does NOT mean

- ❌ Does not mean Real Worker has external-system authority (no Linear/Notion writes)
- ❌ Does not mean production deployment is authorized
- ❌ Does not supersede NIT-22 evidence from Stage 7A (different stage, different proof)
- ❌ Does not count as `external_verified` — evidence status is `app_persisted`

## Next Stage

Stage 7C: Health/Recovery live runtime verification — requires Owner gate.
