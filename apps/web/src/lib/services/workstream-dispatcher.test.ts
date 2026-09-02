import { afterEach, describe, expect, it } from "vitest";
import path from "path";
import { promises as fs } from "fs";
import { DevFileRepository } from "@/lib/repositories/dev-file-store";
import { analyzeIntake, confirmIntake, createIntake } from "@/lib/services/intake-service";
import { initializeMissionControlState } from "@/lib/services/aipos-supervisor";
import { analyzeMissionHeuristic } from "@/lib/services/analyze";
import { buildMissionContextPack, buildMissionStrategy } from "@/lib/services/mission-strategist";
import { decomposeMissionStrategy } from "@/lib/services/decomposer";
import { dispatchWorkstreams, repairDispatchWriteback } from "@/lib/services/workstream-dispatcher";
import { getMissionControlState } from "@/lib/services/control-plane-state";

const tmpRoot = path.join(process.cwd(), ".data-test-dispatcher");

afterEach(async () => {
  globalThis.__aiposRepo = undefined;
  await fs.rm(tmpRoot, { recursive: true, force: true });
});

describe("workstream dispatcher", () => {
  async function seededMission() {
    globalThis.__aiposRepo = new DevFileRepository(tmpRoot);
    globalThis.__aiposPersistenceMode = "dev-file";
    process.env.NOTION_MOCK_SUCCESS = "true";
    const { bundle } = await createIntake(
      {
        raw_request: "Implement a small TypeScript helper with acceptance criteria",
        idempotency_key: "IDEM-DSP-1",
      },
      "operator:test",
    );
    await analyzeIntake(bundle.intake_id, "operator:test");
    const confirmed = await confirmIntake(
      bundle.intake_id,
      { reason: "confirm", sensitivity_acknowledged: true },
      "operator:test",
    );
    expect(confirmed.ok).toBe(true);
    if (!confirmed.ok) throw new Error("confirm failed");
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
            id: "CTX-DSP",
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
    return { missionId: confirmed.mission_id, workstreams: decomposeMissionStrategy(strategy) };
  }

  it("is idempotent via search-before-create and reuses existing mapping", async () => {
    const { missionId, workstreams } = await seededMission();
    const memory: Record<string, { id: string; title: string }> = {};
    let creates = 0;
    const adapter = {
      searchByCorrelationId: async (correlationId: string) => memory[correlationId] ?? null,
      createWorkstreamIssue: async (input: { correlationId: string; title: string }) => {
        creates += 1;
        const row = { id: `LIN-${creates}`, title: input.title };
        memory[input.correlationId] = row;
        return row;
      },
    };

    const first = await dispatchWorkstreams({
      missionId,
      workstreams,
      adapter,
      actor: "dispatcher",
    });
    expect(first.blocked).toHaveLength(0);
    expect(first.dispatched.length).toBe(workstreams.length);
    expect(creates).toBe(workstreams.length);

    const second = await dispatchWorkstreams({
      missionId,
      workstreams,
      adapter,
      actor: "dispatcher",
    });
    expect(second.dispatched.every((d) => d.reused)).toBe(true);
    expect(creates).toBe(workstreams.length);
  });

  it("fails closed when search throws", async () => {
    const { missionId, workstreams } = await seededMission();
    const result = await dispatchWorkstreams({
      missionId,
      workstreams: workstreams.slice(0, 1),
      adapter: {
        searchByCorrelationId: async () => {
          throw new Error("search unavailable");
        },
        createWorkstreamIssue: async () => {
          throw new Error("should not create");
        },
      },
      actor: "dispatcher",
    });
    expect(result.blocked.length).toBe(1);
    expect(result.dispatched).toHaveLength(0);
    const state = await getMissionControlState(missionId);
    expect(state.mission_state).toBe("BLOCKED");
  });

  it("repairs write-back after external create succeeded", async () => {
    const { missionId, workstreams } = await seededMission();
    await dispatchWorkstreams({
      missionId,
      workstreams: workstreams.slice(0, 1),
      adapter: {
        searchByCorrelationId: async () => null,
        createWorkstreamIssue: async () => ({ id: "LIN-REPAIR", title: "t" }),
      },
      actor: "dispatcher",
    });
    const repaired = await repairDispatchWriteback({
      missionId,
      workstreamId: workstreams[0]!.workstream_id,
      linearIssueId: "LIN-REPAIR",
      actor: "dispatcher",
    });
    expect(repaired?.linear_issue_id).toBe("LIN-REPAIR");
    expect(repaired?.status).toBe("DISPATCHED");
  });
});
