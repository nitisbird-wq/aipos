/**
 * A3 Full Mission E2E Proof — ONE bounded staging run.
 *
 * Proves the complete chain using existing infrastructure only:
 *   Mission → canonical plan APPROVED → DISPATCHABLE
 *   → Dispatch (live Linear) → n8n staging attempt
 *   → Evidence/Audit recorded → Handoff
 *
 * Constraints (enforced structurally):
 * - No new features/architecture — uses only existing services
 * - No production n8n — attempts staging webhook only
 * - No production Linear team changes beyond the sandbox issue
 * - Notion: mock only (no NOTION_TOKEN in this environment)
 * - Uses PR #27 path: generateMissionPlan + applyDecisionBundle
 *
 * Run: tsx apps/web/scripts/full-e2e-proof.ts
 */

import { resolve } from "path";
import { loadLocalEnvFile } from "./load-local-env";
import { DevFileRepository } from "@/lib/repositories/dev-file-store";
import { analyzeIntake, confirmIntake, createIntake } from "@/lib/services/intake-service";
import { initializeMissionControlState } from "@/lib/services/aipos-supervisor";
import { analyzeMissionHeuristic } from "@/lib/services/analyze";
import { buildMissionContextPack, buildMissionStrategy } from "@/lib/services/mission-strategist";
import {
  generateMissionPlan,
  getPlanReviewState,
  dispatchableWorkstreams,
} from "@/lib/services/mission-plan";
import { applyDecisionBundle } from "@/lib/services/plan-decision-applier";
import {
  asLinearDispatchAdapter,
  getLinearDispatchClient,
  preflightLiveLinearConnection,
} from "@/lib/linear/client";
import { dispatchWorkstreams } from "@/lib/services/workstream-dispatcher";
import {
  getMissionControlState,
  upsertMissionControlState,
} from "@/lib/services/control-plane-state";
import { createLiveN8nWorkerAdapter } from "@/lib/services/n8n-worker-adapter";
import { STAGING_WORKFLOW } from "@/lib/services/mission-e2e-7d-proof";
import { nowIso } from "@/lib/ids";

const IDEMPOTENCY_KEY = "A3-FULL-E2E-PROOF-001"; // gitleaks:allow
const STORE_DIR = resolve(process.cwd(), ".data-a3-e2e-proof");
const RAW_REQUEST =
  "A3 E2E proof: research brain-training games for children with measurable success criteria and evidence-backed recommendations";
const ACTOR = "operator:a3-e2e-proof";

function step(name: string, detail: string): void {
  process.stderr.write(`[${nowIso()}] ${name}: ${detail}\n`);
}

function fail(message: string): never {
  throw new Error(message);
}

async function main(): Promise<void> {
  loadLocalEnvFile();

  // Force Notion to mock — no NOTION_TOKEN configured in this environment.
  process.env.NOTION_ADAPTER = "mock";
  process.env.NOTION_MOCK_SUCCESS = "true";

  const apiKey = process.env.LINEAR_API_KEY?.trim();
  const teamId = process.env.LINEAR_TEAM_ID?.trim();
  const linearMode = (process.env.LINEAR_ADAPTER ?? "").trim().toLowerCase();
  if (linearMode !== "live" || !apiKey || !teamId) {
    fail("LINEAR_ADAPTER=live, LINEAR_API_KEY, LINEAR_TEAM_ID all required");
  }

  const evidence: Record<string, unknown> = {
    started_at: nowIso(),
    idempotency_key: IDEMPOTENCY_KEY,
  };

  // ── Step 0: Linear preflight (read-only) ─────────────────────────────────
  step("linear_preflight", "verifying live credentials");
  const preflight = await preflightLiveLinearConnection({ apiKey: apiKey!, teamId: teamId! });
  evidence.linear_preflight = {
    authenticated: preflight.authenticated,
    viewer: preflight.viewer,
    team: preflight.team,
  };
  step("linear_preflight", `ok viewer=${preflight.viewer.name} team=${preflight.team.name}`);

  // ── Step 1: Mission creation ──────────────────────────────────────────────
  step("mission_create", "creating intake in isolated dev-file store");
  globalThis.__aiposRepo = new DevFileRepository(STORE_DIR);
  globalThis.__aiposPersistenceMode = "dev-file";

  const { bundle } = await createIntake(
    { raw_request: RAW_REQUEST, idempotency_key: IDEMPOTENCY_KEY },
    ACTOR,
  );
  if (!bundle.confirmed_by_user) {
    await analyzeIntake(bundle.intake_id, ACTOR);
  }
  const confirmed = await confirmIntake(
    bundle.intake_id,
    { reason: "A3 full E2E proof run", sensitivity_acknowledged: true },
    ACTOR,
  );
  if (!confirmed.ok) fail(`INTAKE_CONFIRM_FAILED: ${JSON.stringify(confirmed.error)}`);

  const missionId = confirmed.mission_id;
  await initializeMissionControlState(missionId);
  evidence.mission = { mission_id: missionId, intake_id: bundle.intake_id };
  step("mission_create", `mission_id=${missionId}`);

  // ── Step 2: Plan generation (via PR #27 path) ─────────────────────────────
  step("plan_generate", "building strategy + generating plan with PROPOSED workstreams");
  const analysis = analyzeMissionHeuristic(bundle.raw_request);
  const strategy = buildMissionStrategy({
    missionId,
    analysis,
    contextPack: buildMissionContextPack({
      missionId,
      actor: ACTOR,
      context: [
        {
          id: `CTX-${missionId}`,
          context_class: "LIVE",
          domain: "mission",
          type: "request",
          statement: bundle.raw_request,
          source: "web_app",
          provenance: `a3-e2e:${bundle.intake_id}`,
          status: "REPORTED",
          version: "1.0",
          effective_at: nowIso(),
          freshness: "fresh",
          review_due: new Date(Date.now() + 3600_000).toISOString(),
          confidence: 0.9,
          evidence: [],
          owner: ACTOR,
          approver: ACTOR,
          sensitivity: "internal",
          access: "need_to_know",
          supersedes: [],
          conflicts_with: [],
        },
      ],
    }),
  });
  const plan = await generateMissionPlan({ missionId, strategy, actor: ACTOR });
  evidence.plan = {
    plan_id: plan.plan_id,
    workstream_count: plan.workstreams.length,
    review_status: plan.review_status,
    updated_at: plan.updated_at,
  };
  step(
    "plan_generate",
    `plan_id=${plan.plan_id} workstreams=${plan.workstreams.length} status=${plan.review_status}`,
  );

  // ── Step 3: Decision Bundle — APPROVE all → DISPATCHABLE ─────────────────
  step("decision_bundle", "applying APPROVE decisions to all workstreams");
  const currentPlan = await getPlanReviewState(missionId);
  if (!currentPlan) fail("PLAN_NOT_FOUND after generate");

  const bundleResult = await applyDecisionBundle(
    {
      mission_id: missionId,
      plan_version: currentPlan.updated_at,
      submitted_at: nowIso(),
      decisions: currentPlan.workstreams.map((ws) => ({
        workstream_id: ws.workstream_id,
        decision: "APPROVE" as const,
      })),
    },
    ACTOR,
  );

  if (!bundleResult.ok) {
    fail(`DECISION_BUNDLE_FAILED: ${JSON.stringify(bundleResult.verifications)}`);
  }

  const approvedPlan = bundleResult.canonical_plan;
  const dispatchable = dispatchableWorkstreams(approvedPlan);
  evidence.decision_bundle = {
    ok: bundleResult.ok,
    applied: bundleResult.applied,
    failed: bundleResult.failed,
    review_status: approvedPlan.review_status,
    dispatchable_count: dispatchable.length,
  };
  step(
    "decision_bundle",
    `ok=${bundleResult.ok} review_status=${approvedPlan.review_status} dispatchable=${dispatchable.length}`,
  );

  if (dispatchable.length === 0) fail("NO_DISPATCHABLE_WORKSTREAMS after Decision Bundle");

  // ── Step 4: Live Linear dispatch ──────────────────────────────────────────
  step("linear_dispatch", "dispatching first DISPATCHABLE workstream via live Linear");
  const linearClient = getLinearDispatchClient();
  if (linearClient.adapterName !== "live") fail("Expected live Linear adapter");
  const linearAdapter = asLinearDispatchAdapter(linearClient);

  const firstWs = dispatchable[0]!;
  const dispatchResult = await dispatchWorkstreams({
    missionId,
    workstreams: [firstWs],
    adapter: linearAdapter,
    actor: ACTOR,
  });

  if (dispatchResult.blocked.length > 0) {
    fail(`DISPATCH_BLOCKED: ${dispatchResult.blocked.map((b) => b.reason).join("; ")}`);
  }

  const dispatchedRow = dispatchResult.dispatched[0];
  if (!dispatchedRow?.linear_issue_id) fail("DISPATCH_NO_ISSUE_ID");

  // Readback: verify control-plane state has the Linear issue mapping
  const dispatchedState = await getMissionControlState(missionId);
  const dispatchedWsRow = dispatchedState.workstreams.find(
    (w) => w.workstream_id === firstWs.workstream_id,
  );
  if (dispatchedWsRow?.linear_issue_id !== dispatchedRow.linear_issue_id) {
    fail("DISPATCH_RECONCILE_MISMATCH: state linear_issue_id does not match dispatch result");
  }
  if (dispatchedWsRow?.status !== "DISPATCHED") {
    fail(`DISPATCH_STATUS_MISMATCH: expected DISPATCHED got ${dispatchedWsRow?.status}`);
  }

  // Linear readback: search by correlation_id confirms the issue exists in Linear
  const correlationId = `DSP-${missionId}-${firstWs.workstream_id}`;
  const linearReadback = await linearClient.searchByCorrelationId(correlationId);
  if (!linearReadback) fail("LINEAR_READBACK_MISSING: correlation_id search returned null");

  evidence.linear_dispatch = {
    workstream_id: firstWs.workstream_id,
    correlation_id: correlationId,
    linear_issue_id: dispatchedRow.linear_issue_id,
    linear_identifier: linearReadback.identifier ?? null,
    linear_title: linearReadback.title,
    state_status: dispatchedWsRow?.status,
    readback_matched: true,
    reused: dispatchedRow.reused,
  };
  step(
    "linear_dispatch",
    `issue_id=${dispatchedRow.linear_issue_id} identifier=${linearReadback.identifier ?? "?"} readback_matched=true`,
  );

  // ── Step 5: n8n staging attempt ───────────────────────────────────────────
  const stagingWebhookUrl = STAGING_WORKFLOW.webhook_url;
  step("n8n_staging", `attempting staging webhook: ${stagingWebhookUrl}`);
  let n8nResult: { ok: boolean; status: string; error?: string; blocker?: string };
  try {
    const n8nAdapter = createLiveN8nWorkerAdapter(stagingWebhookUrl);
    const output = await n8nAdapter.trigger({
      mission_id: missionId,
      workstream_id: firstWs.workstream_id,
      correlation_id: correlationId,
      action_type: "execute",
    });
    n8nResult = {
      ok: output.ok,
      status: output.ok ? "PASS" : "FAIL",
      error: output.error,
    };
    step("n8n_staging", `ok=${output.ok} artifact=${output.result_artifact ?? "null"}`);
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : "unknown";
    n8nResult = {
      ok: false,
      status: "BLOCKED",
      error: errMsg,
      blocker:
        `Staging n8n webhook returned error: ${errMsg}. ` +
        `Workflow ${STAGING_WORKFLOW.workflow_id} (${STAGING_WORKFLOW.workflow_name}) is inactive. ` +
        "OWNER ACTION REQUIRED: activate workflow in n8n cloud before live E2E can complete.",
    };
    step("n8n_staging", `BLOCKED: ${errMsg}`);
  }
  evidence.n8n_staging = {
    webhook_url: stagingWebhookUrl,
    workflow_id: STAGING_WORKFLOW.workflow_id,
    workflow_active: STAGING_WORKFLOW.active,
    ...n8nResult,
  };

  // ── Step 6: Evidence/Audit recorded ──────────────────────────────────────
  step("evidence_audit", "writing evidence record to control-plane state");
  const preState = await getMissionControlState(missionId);
  await upsertMissionControlState(missionId, ACTOR, {
    artifacts: [
      ...preState.artifacts,
      {
        mission_id: missionId,
        workstream_id: firstWs.workstream_id,
        artifact_id: `A3-PROOF-${Date.now()}`,
        uri: `a3-proof://${missionId}/${firstWs.workstream_id}/${IDEMPOTENCY_KEY}`,
        kind: "e2e_proof_evidence",
        created_at: nowIso(),
      },
    ],
    updated_at: nowIso(),
  });

  // Evidence readback
  const auditState = await getMissionControlState(missionId);
  const evidenceArtifact = auditState.artifacts.find((a) => a.uri.includes(IDEMPOTENCY_KEY));
  evidence.audit = {
    artifact_stored: !!evidenceArtifact,
    artifact_uri: evidenceArtifact?.uri ?? null,
    readback_confirmed: !!evidenceArtifact,
  };
  step(
    "evidence_audit",
    `artifact_stored=${!!evidenceArtifact} readback_confirmed=${!!evidenceArtifact}`,
  );

  // ── Step 7: Notion SSOT readback ─────────────────────────────────────────
  // Notion adapter is mock — NOTION_TOKEN not configured in this environment.
  evidence.notion_readback = {
    adapter: "mock",
    note: "NOTION_TOKEN not set in this environment. Notion readback is mock-only. OWNER ACTION REQUIRED: set NOTION_TOKEN in Claude Code Remote env vars to enable live Notion readback.",
    status: "BLOCKED_NOT_CONFIGURED",
  };
  step("notion_readback", "BLOCKED: NOTION_TOKEN not configured, using mock");

  // ── Final report ──────────────────────────────────────────────────────────
  const allBlocked = [
    ...(n8nResult.ok ? [] : [`n8n staging webhook: ${n8nResult.blocker ?? n8nResult.error}`]),
    "Notion readback: NOTION_TOKEN not set in environment",
  ];

  const chainProven = [
    `Mission: ${missionId}`,
    `Plan APPROVED: review_status=${approvedPlan.review_status} dispatchable=${dispatchable.length}`,
    `DISPATCHABLE: ${dispatchable.length} workstream(s)`,
    `Live Linear dispatch: issue=${dispatchedRow.linear_issue_id} identifier=${linearReadback.identifier ?? "?"} readback_matched=true`,
    `Evidence/Audit: artifact_stored=${!!evidenceArtifact} readback_confirmed=${!!evidenceArtifact}`,
  ];

  const report = {
    ok: allBlocked.length === 0,
    a3_live_e2e: allBlocked.length === 0 ? "PASS" : "PARTIAL — see remaining_blockers",
    mission_id: missionId,
    chain_proven: chainProven,
    remaining_blockers: allBlocked,
    evidence,
    completed_at: nowIso(),
    note: "Run this script again after Owner activates n8n staging workflow and sets NOTION_TOKEN to complete the full E2E.",
  };

  console.log(JSON.stringify(report, null, 2));
}

main().catch((err: unknown) => {
  const msg = err instanceof Error ? err.message : "unknown";
  console.error(`A3 Full E2E Proof failed: ${msg}`);
  process.exitCode = 1;
});
