import { afterEach, describe, expect, it } from "vitest";
import { createMockLinearClient, getLinearDispatchClient } from "@/lib/linear/client";
import { dispatchWorkstreams } from "@/lib/services/workstream-dispatcher";
import { DevFileRepository } from "@/lib/repositories/dev-file-store";
import path from "path";
import { promises as fs } from "fs";
import { analyzeIntake, confirmIntake, createIntake } from "@/lib/services/intake-service";
import { initializeMissionControlState } from "@/lib/services/aipos-supervisor";
import { analyzeMissionHeuristic } from "@/lib/services/analyze";
import { buildMissionContextPack, buildMissionStrategy } from "@/lib/services/mission-strategist";
import { decomposeMissionStrategy } from "@/lib/services/decomposer";

const tmpRoot = path.join(process.cwd(), ".data-test-linear-adapter");

afterEach(async () => {
  globalThis.__aiposRepo = undefined;
  (globalThis as { __aiposLinearMock?: unknown }).__aiposLinearMock = undefined;
  process.env.LINEAR_ADAPTER = "mock";
  delete process.env.LINEAR_API_KEY;
  delete process.env.LINEAR_TEAM_ID;
  await fs.rm(tmpRoot, { recursive: true, force: true });
});

describe("Linear dispatch client", () => {
  it("defaults to mock and is idempotent by correlation id", async () => {
    process.env.LINEAR_ADAPTER = "mock";
    const client = getLinearDispatchClient();
    expect(client.adapterName).toBe("mock");
    const created = await client.createWorkstreamIssue({
      correlationId: "DSP-TEST-WS1",
      title: "Test workstream",
      body: "body",
    });
    const again = await client.createWorkstreamIssue({
      correlationId: "DSP-TEST-WS1",
      title: "Test workstream",
      body: "body",
    });
    expect(again.id).toBe(created.id);
    const found = await client.searchByCorrelationId("DSP-TEST-WS1");
    expect(found?.id).toBe(created.id);
  });

  it("fails closed when live mode lacks credentials", () => {
    process.env.LINEAR_ADAPTER = "live";
    expect(() => getLinearDispatchClient()).toThrow(/LINEAR_LIVE_MISCONFIGURED/);
  });

  it("integrates mock client with dispatcher", async () => {
    globalThis.__aiposRepo = new DevFileRepository(tmpRoot);
    globalThis.__aiposPersistenceMode = "dev-file";
    process.env.NOTION_MOCK_SUCCESS = "true";
    process.env.LINEAR_ADAPTER = "mock";

    const { bundle } = await createIntake(
      {
        raw_request: "Implement a small TypeScript helper with acceptance criteria",
        idempotency_key: "IDEM-LIN-1",
      },
      "operator:test",
    );
    await analyzeIntake(bundle.intake_id, "operator:test");
    const confirmed = await confirmIntake(
      bundle.intake_id,
      { reason: "go", sensitivity_acknowledged: true },
      "operator:test",
    );
    expect(confirmed.ok).toBe(true);
    if (!confirmed.ok) return;
    await initializeMissionControlState(confirmed.mission_id);
    const analysis = analyzeMissionHeuristic(bundle.raw_request);
    const strategy = buildMissionStrategy({
      missionId: confirmed.mission_id,
      analysis,
      contextPack: buildMissionContextPack({
        missionId: confirmed.mission_id,
        actor: "operator:test",
        context: [
          {
            id: "CTX-LIN",
            context_class: "LIVE",
            domain: "mission",
            type: "request",
            statement: bundle.raw_request,
            source: "web_app",
            provenance: `web:${bundle.intake_id}`,
            status: "REPORTED",
            version: "1.0",
            effective_at: new Date().toISOString(),
            freshness: "fresh",
            review_due: new Date(Date.now() + 3600_000).toISOString(),
            confidence: 0.9,
            evidence: [],
            owner: "operator:test",
            sensitivity: "internal",
            access: "need_to_know",
            supersedes: [],
            conflicts_with: [],
          },
        ],
      }),
    });
    const workstreams = decomposeMissionStrategy(strategy);
    const client = createMockLinearClient();
    const result = await dispatchWorkstreams({
      missionId: confirmed.mission_id,
      workstreams,
      adapter: client,
      actor: "dispatcher",
    });
    expect(result.blocked).toHaveLength(0);
    expect(result.dispatched.length).toBe(workstreams.length);
  });
});
