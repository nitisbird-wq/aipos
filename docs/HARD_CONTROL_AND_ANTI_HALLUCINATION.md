# Hard Control and Anti-Hallucination

**Binding decision:** [AIPOS_PHASE_1_DECISIONS.md](./AIPOS_PHASE_1_DECISIONS.md) D4  
**Aligned with:** Command Center Three-State Reporting, Governance OS, STD-002, Phase 1 Pilot gates G0–G5

## Principle

Anti-hallucination is a **backend contract**. Prompts alone are insufficient.

## Epistemic labels

Every operational fact in bundles, plans, artifacts, and chat replies should carry one of:

| Label | Use |
|---|---|
| `confirmed` | Verified source; may drive actions |
| `reported` | Cited source, not yet verified |
| `inferred` | Derived; must be labeled |
| `hypothesis` | For analysis only; never basis for external write |
| `unknown` | Forces blocker or targeted question |

Unlabeled claims about identity, authority, family, cases, or external system state → reject or downgrade to `unknown`.

## Three-State Reporting

| State | Meaning | Allowed claim language |
|---|---|---|
| `session_only` | This chat/turn only | Must not say “saved” / “sent” |
| `app_persisted` | App DB record id exists | “Saved in AIPOS” |
| `external_verified` | External write + readback id | “Synced to Notion (page id…)” |

UI and API must not use success wording for a higher state than achieved. Prefer existing `mock_synced` vs `synced` distinction for the **local/CI mock adapter**. Production Mission Intake Pilot Notion writeback is recorded as **PASS** on [AIPOS CURRENT STATE](https://app.notion.com/p/3cdbc165be4c81c48e73e5899ae5f0e3); app paths may only claim `external_verified` when a verified external page/record ID exists.

## Evidence and handoff spine

- `evidence_objects` with uri/hash/source/sensitivity  
- Mandatory `correlation_id` on transitions and specialist calls  
- `handoff_records` per STD-002 before cross-AI work  
- Merge specialist output only with matching handoff id + artifact version

## Gates G0–G5

| Gate | Check | On failure |
|---|---|---|
| G0 | Real mission (not greeting) | No mission create |
| G1 | Outcome, criteria, role clarity | `needs_input` |
| G2 | Sensitivity + destinations | Block / sanitize |
| G3 | Authority for L3–L4 / high impact | Wait for user |
| G4 | External write only after confirm | Skip adapter |
| G5 | Readback verified id | `failed`; no success claim |

Notion projection authorization fields and invalidation rules: [AIPOS_ARCHITECTURE_CONTRACT.md](./AIPOS_ARCHITECTURE_CONTRACT.md) §1.  
Mission persists if Notion fails; only `sync_status` reflects external outcome (§5).

Extend existing `apps/web/src/lib/gates/` and add Pilot TC-01…TC-08 tests.

## Grounded generation

When LLM analyze/execute is enabled:

1. Context pack = profile slice + `confirmed` facts + retrieved refs only  
2. Zod-constrained structured output  
3. System status from repositories/adapters only  
4. Unknown capability → escalate (never invent specialist)  
5. Verifier strips forbidden success claims before `review`

## Foundation prerequisites

Before full auto-execute:

1. Live Postgres pool (not silent file-store in production)  
2. Real Notion adapter with G5 readback  
3. Policy evaluation from versioned registry  
4. Idempotency on confirm / plan confirm / external write  
5. Need-to-Know redaction before LLM/specialist calls
