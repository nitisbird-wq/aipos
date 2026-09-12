# Stage 7C — Health Supervisor + Recovery/Reconciliation Proof

**Date:** 2026-09-12  
**Branch:** `cursor/master-continuity-strategy-169c` (PR #21)  
**Authority:** ADR-007 D-007.6 Option B — L0–L1 only  
**Status:** COMPLETE — CI pending

---

## Summary

Stage 7C implements and proves the Health Supervisor + Recovery/Reconciliation layer of the AIPOS
control plane. All 11 health failure scenarios are exercised with verified findings and recovery
plans. `reconcileRuntimeAfterExternalAction()` has an Owner-mandated idempotency guard embedded
directly in the function (not only in the proof harness). The proof handoff passes
`evaluateHandoffVerification()`.

---

## Files Changed

| File | Change |
|------|--------|
| `apps/web/src/lib/services/runtime-reconcile.ts` | Added `correlation_id` idempotency guard (Owner-mandated correction) |
| `apps/web/src/lib/services/health-recovery-proof.ts` | New — Stage 7C proof harness |
| `apps/web/src/lib/services/health-recovery-proof.test.ts` | New — 28 unit tests across 4 describe blocks |
| `docs/aipos/STAGE7C_HEALTH_RECOVERY_PROOF.md` | New — this evidence record |

---

## Idempotency Guard (Owner-Mandated)

Implemented inside `reconcileRuntimeAfterExternalAction()` in `runtime-reconcile.ts`:

```typescript
// Idempotency guard — same correlation_id on ok=false must not create duplicate blockers.
if (!input.evidence.ok && input.evidence.correlation_id) {
  const corrTag = `[corr:${input.evidence.correlation_id}]`;
  const alreadyReconciled = state.blockers.some((b) => b.detail.includes(corrTag));
  if (alreadyReconciled) {
    return state;
  }
}
```

The `correlation_id` is embedded as `[corr:<id>]` in the blocker `detail` field for O(n) lookup
on subsequent calls. Repeating the same `mission_id + correlation_id` with `ok=false` returns the
existing state unchanged — no duplicate blockers, audit events, or external actions.

---

## Health Scenarios Exercised

All 11 scenarios from `evaluateMissionHealth()` are covered:

| Scenario | Expected Status | Finding Keyword |
|----------|-----------------|-----------------|
| `stale_state` | WARNING | "stale" |
| `duplicate_workstream` | CRITICAL | "duplicate" |
| `dispatched_no_handoff` | WARNING | "handoff" |
| `failed_execution` | BLOCKED | "failed execution" |
| `notion_sync_failed` | WARNING | "notion" |
| `orphan_linear` | BLOCKED | "orphan" |
| `divergent_mapping` | CRITICAL | "divergen" |
| `waiting_human_within_sla` | WARNING | "waiting-human" |
| `waiting_human_over_sla` | BLOCKED | "over SLA" |
| `stale_evidence` | WARNING | "stale evidence" |
| `completed_no_artifact` | CRITICAL | "completed workstream" |

---

## Test Results

```
✓ health scenario detection (12 tests)
  ✓ returns HEALTHY on a clean mission state
  ✓ stale_state: state older than 1h → WARNING with stale finding
  ✓ duplicate_workstream: two workstreams with same ID → CRITICAL
  ✓ dispatched_no_handoff: DISPATCHED workstream with no handoff → WARNING
  ✓ failed_execution: FAILED workstream → BLOCKED
  ✓ notion_sync_failed: repo returns sync_status=failed → WARNING
  ✓ orphan_linear: DISPATCHED workstream with no linear_issue_id → BLOCKED
  ✓ divergent_mapping: PENDING workstream with linear_issue_id → CRITICAL
  ✓ waiting_human_within_sla: human blocker < 4h → WARNING
  ✓ waiting_human_over_sla: human blocker > 4h → BLOCKED
  ✓ stale_evidence: handoff with freshness=stale → WARNING
  ✓ completed_no_artifact: COMPLETED workstream without artifact → CRITICAL

✓ recovery plan generation (4 tests)
  ✓ buildRecoveryPlan produces a valid recovery.v1 contract
  ✓ WARNING scenario maps to RETRY preferred recovery
  ✓ CRITICAL scenario maps to RECONCILE preferred recovery
  ✓ BLOCKED scenario maps to ESCALATE preferred recovery

✓ reconcileRuntimeAfterExternalAction idempotency (7 tests)
  ✓ first call with ok=false adds a blocker containing the correlation_id
  ✓ second call with same correlation_id returns existing state unchanged
  ✓ readback after first call confirms blocker in persisted state
  ✓ readback after second call: state unchanged — blocker count still 1
  ✓ concurrent calls with same correlation_id: documents non-atomic behaviour
  ✓ calls without correlation_id are not idempotency-guarded (each adds a blocker)
  ✓ ok=true call with workstreamPatch updates workstream status and adds no blocker

✓ runHealthRecoveryProof integration (5 tests)
  ✓ detects HEALTHY baseline on clean state
  ✓ all 11 scenarios produce non-HEALTHY results with findings and recovery plans
  ✓ reconcile is idempotent — second call blocker count unchanged
  ✓ proof handoff passes evaluateHandoffVerification
  ✓ audit trail covers start, all scenarios, reconcile, readback, supervisor, handoff steps

Tests: 28 passed (28)
```

Full suite: **159 passed | 7 skipped | 0 failed** (32 test files)

---

## Quality Gates

| Gate | Result |
|------|--------|
| `npx prettier --check` (3 files) | ✅ PASS |
| `npx eslint` (3 files) | ✅ PASS (0 errors, 0 warnings) |
| `vitest run` (28 new tests) | ✅ 28/28 PASS |
| `vitest run` (full suite) | ✅ 159/166 pass, 7 skipped (existing) |
| `next build` | ✅ PASS |
| AIPOS Doctor | ✅ 32 pass, 0 fail, 0 critical — CONDITIONALLY READY |
| Secret scan | ✅ No secrets in new/modified files |

---

## Evidence Claims

All claims have `status: "CONFIRMED"` and non-empty `verified_by` (no silent promotion):

1. **HEALTHY baseline** — clean `MissionControlState` produces `status=HEALTHY, findings=0`
2. **11 scenarios** — each produces expected non-HEALTHY status with at least one finding
3. **Recovery plans** — `RecoveryContract` built for every non-HEALTHY scenario, `recovery_version: "recovery.v1"`
4. **Reconcile idempotency** — `reconcileRuntimeAfterExternalAction` with same `correlation_id` returns unchanged state; `first_blockers_count === second_blockers_count`
5. **Readback** — state re-read from `getMissionControlState` after reconcile confirms blocker count stable
6. **Supervisor assessment** — `runSupervisorAssessment` completes within L1 authority
7. **Handoff verification** — `evaluateHandoffVerification(handoff).pass === true`

---

## Forbidden Actions Confirmed

Per ADR-007 D-007.6 and Owner Stage 7C approval:

- ✅ No direct Linear / Notion / DB writes
- ✅ No secrets modification
- ✅ No production deploy
- ✅ No Phase 1–2 mutation
- ✅ No orphan-branch deletion
- ✅ No new Project or Mission
- ✅ No PR auto-merge

---

## Next Steps (Pending CI)

After CI green on PR #21:

1. Update Notion PRJ-2 status → Stage 7C COMPLETE
2. Proceed to Full Mission E2E Readiness Analysis (automated)
3. Stop at next genuine Human Gate (Stage 7D — n8n integration or E2E gate)
