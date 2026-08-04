import { afterEach, describe, expect, it } from "vitest";
import path from "path";
import { promises as fs } from "fs";
import { DevFileRepository } from "@/lib/repositories/dev-file-store";
import { analyzeIntake, confirmIntake, createIntake } from "@/lib/services/intake-service";
import {
  assessToolAuthority,
  loadToolRegistry,
  probeToolConnection,
  runCapabilityPreflight,
} from "@/lib/services/preflight-service";
import type { IntakeMissionBundle } from "@/lib/schemas/intake";
import type { ToolRegistryEntry } from "@/lib/schemas/preflight";
import { ConnectionStatusSchema, AuthorityStatusSchema } from "@/lib/schemas/preflight";

const tmpRoot = path.join(process.cwd(), ".data-test-preflight");
const repoRoot = path.resolve(process.cwd(), "../..");

async function resetRepo() {
  await fs.rm(tmpRoot, { recursive: true, force: true });
  const repo = new DevFileRepository(tmpRoot);
  globalThis.__aiposRepo = repo;
  globalThis.__aiposPersistenceMode = "dev-file";
  return repo;
}

afterEach(async () => {
  globalThis.__aiposRepo = undefined;
  await fs.rm(tmpRoot, { recursive: true, force: true });
  delete process.env.OPENAI_API_KEY;
  delete process.env.ANTHROPIC_API_KEY;
  process.env.NOTION_ADAPTER = "mock";
});

function baseBundle(over: Partial<IntakeMissionBundle> = {}): IntakeMissionBundle {
  return {
    intake_id: "INT-PREFLIGHT01",
    intake_version: "1.0",
    requester_id: "operator:test",
    source: "web_app",
    source_message_ref: "web:INT-PREFLIGHT01",
    raw_request: "Summarize the quarterly docs for leadership",
    mission_summary: "Summarize quarterly docs",
    desired_outcome: "Leadership has a concise summary",
    success_criteria: ["Summary delivered"],
    constraints: [],
    assumptions: [],
    missing_blockers: [],
    draft_workstreams: [
      {
        workstream_id: "WS-1",
        title: "Summarize",
        objective: "Write summary",
        suggested_capability_family: "docs",
        dependencies: [],
        risk_level: "L1",
        approval_points: [],
      },
    ],
    capability_families: ["docs"],
    operational_risk: "L1",
    sensitivity_flags: [],
    sensitivity_acknowledged: false,
    approval_requirements: [],
    knowledge_refs: [],
    attachments: [],
    data_destinations: [
      {
        system: "intake_channel",
        trust_class: "approved_private",
        purpose: "chat_only",
        persistence: "conversation_only",
        external_transfer: false,
      },
    ],
    data_handling_requirements: [],
    deadline: null,
    readiness_status: "awaiting_confirmation",
    confirmed_by_user: true,
    idempotency_key: "IDEM-PF-1",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...over,
  };
}

describe("Preflight honesty claims", () => {
  it("rejects Connected claim without probe_id", () => {
    expect(() =>
      ConnectionStatusSchema.parse({
        tool_id: "tool:openai",
        status: "credential_present",
        probed_at: new Date().toISOString(),
        evidence: { method: "env_presence", summary: "key present", probe_id: null },
        claims: { connected: true, verified: false },
      }),
    ).toThrow();
  });

  it("rejects Authorized claim without grant_evidence", () => {
    expect(() =>
      AuthorityStatusSchema.parse({
        tool_id: "tool:openai",
        status: "insufficient",
        missing_permissions: ["openai:chat_completions"],
        required_approvals: [],
        claims: { authorized: true },
        grant_evidence: null,
        assessed_at: new Date().toISOString(),
      }),
    ).toThrow();
  });

  it("mock Notion is mock_only and never verified/connected", () => {
    process.env.NOTION_ADAPTER = "mock";
    const tool: ToolRegistryEntry = {
      tool_id: "tool:notion",
      display_name: "Notion",
      kind: "connector",
      capability_ids: ["knowledge.manage"],
      capability_families: ["knowledge_management"],
      enabled: true,
      required_permissions: ["notion:write_mission_page"],
      connect_instructions: "Set NOTION_TOKEN",
      credential_env_keys: ["NOTION_TOKEN"],
      allows_manual_fallback: true,
      execution_phase: "intake_support",
    };
    const conn = probeToolConnection(tool);
    expect(conn.status).toBe("mock_only");
    expect(conn.claims.connected).toBe(false);
    expect(conn.claims.verified).toBe(false);
    const auth = assessToolAuthority(tool, conn, "L1");
    expect(auth.claims.authorized).toBe(false);
    expect(auth.missing_permissions.length).toBeGreaterThan(0);
  });
});

describe("Preflight dispositions", () => {
  it("returns connect_required with connector name + instructions when tools exist but not ready", async () => {
    const registry = await loadToolRegistry(repoRoot);
    const result = await runCapabilityPreflight({
      bundle: baseBundle(),
      missionId: "MIS-PREFLIGHT01",
      registry,
    });
    expect(result.disposition).toBe("connect_required");
    expect(result.claims.any_connected).toBe(false);
    expect(result.claims.any_authorized).toBe(false);
    expect(result.claims.any_verified).toBe(false);
    expect(result.manual_fallback.allowed).toBe(false);
    const connect = result.user_actions.find((a) => a.code === "CONNECT_TOOL");
    expect(connect).toBeTruthy();
    expect(connect?.tool_id).toBeTruthy();
    expect(connect?.connect_instructions).toMatch(/Set |Connect |Authorize /);
    expect(result.assignment_execution_blocked).toBe(true);
  });

  it("lists missing permissions when credentials present but not granted", async () => {
    process.env.OPENAI_API_KEY = "sk-test-not-a-real-key";
    const registry = await loadToolRegistry(repoRoot);
    const result = await runCapabilityPreflight({
      bundle: baseBundle({ capability_families: ["docs"] }),
      missionId: "MIS-PREFLIGHT02",
      registry,
    });
    expect(["connect_required", "permission_required"]).toContain(result.disposition);
    const grant = result.user_actions.find((a) => a.code === "GRANT_PERMISSION");
    expect(grant?.missing_permissions?.length).toBeGreaterThan(0);
    expect(result.claims.any_authorized).toBe(false);
    expect(result.claims.any_connected).toBe(false);
  });

  it("requires approval for L3 even with credentials present", async () => {
    process.env.OPENAI_API_KEY = "sk-test-not-a-real-key";
    const registry = await loadToolRegistry(repoRoot);
    const result = await runCapabilityPreflight({
      bundle: baseBundle({
        operational_risk: "L3",
        capability_families: ["docs"],
      }),
      missionId: "MIS-PREFLIGHT03",
      registry,
    });
    const openaiAuth = result.authority_results.find((a) => a.tool_id === "tool:openai");
    expect(openaiAuth?.required_approvals).toContain("authority_approval");
    expect(
      result.disposition === "approval_required" ||
        result.blocking_codes.includes("APPROVAL_REQUIRED") ||
        openaiAuth?.status === "requires_approval" ||
        result.user_actions.some((a) => a.code === "OBTAIN_APPROVAL") ||
        result.disposition === "connect_required",
    ).toBe(true);
    // Still must not claim authorized
    expect(result.claims.any_authorized).toBe(false);
  });

  it("allows manual only after proving no ready tool (empty candidate set)", async () => {
    const result = await runCapabilityPreflight({
      bundle: baseBundle({ capability_families: ["docs"] }),
      missionId: "MIS-PREFLIGHT04",
      registry: [],
    });
    expect(result.disposition).toBe("manual_fallback_allowed");
    expect(result.manual_fallback.allowed).toBe(true);
    expect(result.user_actions.some((a) => a.code === "NO_TOOL_USE_MANUAL")).toBe(true);
  });
});

describe("Intake confirm wires Preflight + audit", () => {
  it("records preflight:evaluate and stores gate_results.preflight", async () => {
    await resetRepo();
    process.env.NOTION_ADAPTER = "mock";
    process.env.NOTION_MOCK_SUCCESS = "true";
    const { bundle } = await createIntake(
      {
        raw_request: "Summarize the quarterly docs for leadership review",
        idempotency_key: "IDEM-PF-INTAKE-1",
      },
      "operator:test",
    );
    await analyzeIntake(bundle.intake_id, "operator:test");
    const confirmed = await confirmIntake(
      bundle.intake_id,
      { reason: "User confirmed", sensitivity_acknowledged: true },
      "operator:test",
    );
    expect(confirmed.ok).toBe(true);
    if (!confirmed.ok) return;
    expect(confirmed.preflight).toBeTruthy();
    expect(confirmed.preflight?.claims.any_verified).toBe(false);
    expect(confirmed.preflight?.assignment_execution_blocked).toBe(true);

    const repo = globalThis.__aiposRepo as DevFileRepository;
    const mission = await repo.getMissionById(confirmed.mission_id);
    expect(mission?.gate_results?.preflight).toBeTruthy();
    expect(mission?.evidence_refs.some((r) => r.startsWith("preflight:"))).toBe(true);

    const audit = await repo.listAudit({ mission_id: confirmed.mission_id });
    expect(audit.some((e) => e.action === "preflight:evaluate")).toBe(true);
    expect(audit.some((e) => e.action === "mapping:accept")).toBe(true);
  });
});
