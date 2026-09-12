/**
 * Stage 7 — Real Linear end-to-end dispatch harness (Owner-runnable).
 *
 * Performs exactly ONE reversible, idempotent Linear workstream dispatch against
 * the configured live team, then proves:
 *   1. read-only preflight (viewer + exact team mapping),
 *   2. a real issue was created (id + identifier returned),
 *   3. the canonical control-plane state reconciled the workstream -> issue mapping,
 *   4. re-running the dispatch reuses the same issue (idempotency), and
 *   5. an independent correlation-id search reads the issue back.
 *
 * It never deletes or archives the external issue. Re-runs reuse the same issue
 * because the seed intake uses a fixed idempotency key and a dedicated local
 * store, so the mission id -> correlation id -> Linear issue chain stays stable.
 *
 * Requires: LINEAR_ADAPTER=live, LINEAR_API_KEY, LINEAR_TEAM_ID.
 * Notion is forced to mock: this is a Linear-only exercise.
 *
 * Run: npm run linear:e2e
 */
import { resolve } from "path";

import { loadLocalEnvFile } from "./load-local-env";

import { DevFileRepository } from "@/lib/repositories/dev-file-store";
import {
  asLinearDispatchAdapter,
  getLinearDispatchClient,
  preflightLiveLinearConnection,
} from "@/lib/linear/client";
import { analyzeIntake, confirmIntake, createIntake } from "@/lib/services/intake-service";
import { initializeMissionControlState } from "@/lib/services/aipos-supervisor";
import { analyzeMissionHeuristic } from "@/lib/services/analyze";
import { buildMissionContextPack, buildMissionStrategy } from "@/lib/services/mission-strategist";
import { decomposeMissionStrategy } from "@/lib/services/decomposer";
import { dispatchWorkstreams } from "@/lib/services/workstream-dispatcher";
import { getMissionControlState } from "@/lib/services/control-plane-state";
import { nowIso } from "@/lib/ids";
import type { OutcomeWorkstream } from "@/lib/schemas/contracts";

const IDEMPOTENCY_KEY = "STAGE7-LINEAR-E2E";
const STORE_DIR = resolve(process.cwd(), ".data-stage7-e2e");
const RAW_REQUEST =
  "Stage 7 reversible probe: implement a small TypeScript helper and document it with measurable success criteria";
const ACTOR = "operator:stage7-e2e";

function fail(message: string): never {
  throw new Error(message);
}

async function seedReversibleMission(): Promise<{
  missionId: string;
  workstream: OutcomeWorkstream;
}> {
  // Dedicated on-disk store — isolated from Owner mission data and from CI fixtures.
  globalThis.__aiposRepo = new DevFileRepository(STORE_DIR);
  globalThis.__aiposPersistenceMode = "dev-file";

  const { bundle } = await createIntake(
    { raw_request: RAW_REQUEST, idempotency_key: IDEMPOTENCY_KEY },
    ACTOR,
  );
  // On a re-run the seed intake is already confirmed; analysis only applies once.
  if (!bundle.confirmed_by_user) {
    await analyzeIntake(bundle.intake_id, ACTOR);
  }
  const confirmed = await confirmIntake(
    bundle.intake_id,
    { reason: "Stage 7 reversible Linear E2E", sensitivity_acknowledged: true },
    ACTOR,
  );
  if (!confirmed.ok) {
    fail(`SEED_CONFIRM_FAILED: ${confirmed.error.code} — ${confirmed.error.message}`);
  }

  await initializeMissionControlState(confirmed.mission_id);

  const analysis = analyzeMissionHeuristic(bundle.raw_request);
  const strategy = buildMissionStrategy({
    missionId: confirmed.mission_id,
    analysis,
    contextPack: buildMissionContextPack({
      missionId: confirmed.mission_id,
      actor: ACTOR,
      context: [
        {
          id: `CTX-${confirmed.mission_id}`,
          context_class: "LIVE",
          domain: "mission",
          type: "request",
          statement: bundle.raw_request,
          source: "web_app",
          provenance: `stage7:${bundle.intake_id}`,
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

  const workstreams = decomposeMissionStrategy(strategy);
  const first = workstreams[0];
  if (!first) fail("SEED_NO_WORKSTREAM: decomposer produced no workstream");

  return { missionId: confirmed.mission_id, workstream: first };
}

async function main(): Promise<void> {
  loadLocalEnvFile();
  // Linear-only exercise: never touch a real Notion destination from this harness.
  process.env.NOTION_ADAPTER = "mock";
  process.env.NOTION_MOCK_SUCCESS = "true";

  const mode = (process.env.LINEAR_ADAPTER ?? "").trim().toLowerCase();
  const apiKey = process.env.LINEAR_API_KEY?.trim();
  const teamId = process.env.LINEAR_TEAM_ID?.trim();
  if (mode !== "live") fail("LINEAR_ADAPTER must be set to live");
  if (!apiKey || !teamId) fail("LINEAR_API_KEY and LINEAR_TEAM_ID are required");

  // 1. Read-only preflight — authenticated viewer + exact team mapping.
  const preflight = await preflightLiveLinearConnection({ apiKey, teamId });

  // 2. Seed one reversible mission + workstream in an isolated local store.
  const { missionId, workstream } = await seedReversibleMission();
  const workstreamId = workstream.workstream_id;

  const client = getLinearDispatchClient();
  if (client.adapterName !== "live") fail("Expected live Linear adapter");
  const adapter = asLinearDispatchAdapter(client);
  const correlationId = `DSP-${missionId}-${workstreamId}`;

  // 3. First dispatch — the single real external write (idempotent create).
  const oneStream: OutcomeWorkstream[] = [workstream];

  const firstDispatch = await dispatchWorkstreams({
    missionId,
    workstreams: oneStream,
    adapter,
    actor: ACTOR,
  });
  if (firstDispatch.blocked.length > 0) {
    fail(`DISPATCH_BLOCKED: ${firstDispatch.blocked.map((b) => b.reason).join("; ")}`);
  }
  const firstRow = firstDispatch.dispatched.find((row) => row.workstream_id === workstreamId);
  if (!firstRow?.linear_issue_id) fail("DISPATCH_NO_ISSUE_ID: first dispatch returned no issue id");

  // 4. Reconciliation mapping — canonical state now maps workstream -> issue.
  const mappedState = await getMissionControlState(missionId);
  const mappedRow =
    mappedState.workstreams.find((row) => row.workstream_id === workstreamId) ?? null;
  if (mappedRow?.linear_issue_id !== firstRow.linear_issue_id) {
    fail(
      `RECONCILE_MISMATCH: state=${mappedRow?.linear_issue_id ?? "null"} dispatch=${firstRow.linear_issue_id}`,
    );
  }
  if (mappedRow?.status !== "DISPATCHED") {
    fail(`RECONCILE_STATUS: expected DISPATCHED, got ${mappedRow?.status ?? "null"}`);
  }

  // 5. Idempotency — a second dispatch must reuse the same issue, no new write.
  const secondDispatch = await dispatchWorkstreams({
    missionId,
    workstreams: oneStream,
    adapter,
    actor: ACTOR,
  });
  const secondRow = secondDispatch.dispatched.find((row) => row.workstream_id === workstreamId);
  if (!secondRow?.reused) fail("IDEMPOTENCY_FAILED: second dispatch did not reuse the issue");
  if (secondRow.linear_issue_id !== firstRow.linear_issue_id) {
    fail(
      `IDEMPOTENCY_MISMATCH: first=${firstRow.linear_issue_id} second=${secondRow.linear_issue_id}`,
    );
  }

  // 6. Independent readback — correlation-id search resolves the same issue.
  const readback = await client.searchByCorrelationId(correlationId);
  if (!readback) fail("READBACK_MISSING: correlation-id search returned no issue");
  if (readback.id !== firstRow.linear_issue_id) {
    fail(`READBACK_MISMATCH: search=${readback.id} dispatch=${firstRow.linear_issue_id}`);
  }

  console.log(
    JSON.stringify(
      {
        ok: true,
        adapter: "live",
        authenticated: preflight.authenticated,
        viewer: preflight.viewer,
        team: preflight.team,
        write_performed: true,
        writes_count: 1,
        mission_id: missionId,
        workstream_id: workstreamId,
        correlation_id: correlationId,
        linear_issue: {
          id: firstRow.linear_issue_id,
          identifier: readback.identifier ?? null,
          title: readback.title,
        },
        reconciliation: {
          state_issue_id: mappedRow?.linear_issue_id ?? null,
          state_status: mappedRow?.status ?? null,
          matched: true,
        },
        idempotent_reuse: true,
        readback_matched: true,
        deleted_external_issue: false,
        note: "Do not delete or archive the Linear issue without explicit Owner authority.",
        at: nowIso(),
      },
      null,
      2,
    ),
  );
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : "unknown error";
  console.error(`Stage 7 Linear E2E dispatch failed: ${message}`);
  process.exitCode = 1;
});
