import { afterEach, beforeEach, describe, expect, it } from "vitest";
import path from "path";
import { promises as fs } from "fs";
import type { ToolRegistry } from "@/lib/schemas/preflight";
import {
  clearToolRegistryCache,
  loadToolRegistry,
  riskRequiresAuthorityApproval,
  runCapabilityPreflight,
} from "@/lib/services/preflight-service";
import { analyzeIntake, createIntake } from "@/lib/services/intake-service";
import { getRepository } from "@/lib/repositories";
import { DevFileRepository } from "@/lib/repositories/dev-file-store";

const INTAKE = "INT-TESTPREFLIGHT01";

describe("Capability–Connection–Authority Preflight", () => {
  const prevEnv: Record<string, string | undefined> = {};

  beforeEach(() => {
    clearToolRegistryCache();
    for (const k of [
      "ANALYZE_PROVIDER",
      "OPENAI_API_KEY",
      "NOTION_ADAPTER",
      "NOTION_TOKEN",
      "NOTION_MISSIONS_DATABASE_ID",
    ]) {
      prevEnv[k] = process.env[k];
    }
    process.env.ANALYZE_PROVIDER = "none";
    delete process.env.OPENAI_API_KEY;
    process.env.NOTION_ADAPTER = "mock";
    delete process.env.NOTION_TOKEN;
    delete process.env.NOTION_MISSIONS_DATABASE_ID;
  });

  afterEach(() => {
    for (const [k, v] of Object.entries(prevEnv)) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
    clearToolRegistryCache();
  });

  it("loads seed registry matching Phase 2 contract", async () => {
    const registry = await loadToolRegistry();
    expect(registry.length).toBeGreaterThanOrEqual(4);
    expect(registry.some((t) => t.tool_id === "tool:analyze-heuristic")).toBe(true);
    expect(registry.some((t) => t.tool_id === "tool:notion-mission-registry")).toBe(true);
  });

  it("never claims Authorized/Verified for mock Notion; local heuristic can be ready_evidenced", async () => {
    const result = await runCapabilityPreflight({
      intake_id: INTAKE,
      capability_families: ["docs"],
      operational_risk: "L0",
    });

    const notion = result.tools.find((t) => t.tool_id === "tool:notion-mission-registry");
    const heuristic = result.tools.find((t) => t.tool_id === "tool:analyze-heuristic");

    expect(notion?.connection_status).toBe("mock_only");
    expect(heuristic?.connection_status).toBe("ready_evidenced");
    expect(result.tools.every((t) => t.authority_status !== "authorized_evidenced")).toBe(true);
    expect(result.user_diy_allowed).toBe(false);
    expect(result.overall_status).toBe("ready_with_tools");
  });

  it("allows DIY only when no ready tool path exists", async () => {
    const registry: ToolRegistry = [
      {
        tool_id: "tool:only-unknown",
        display_name: "Unknown Adapter",
        kind: "adapter",
        capability_families: ["automation"],
        adapter_id: "adapter:x",
        enabled: true,
        connect_instructions: "Not available in Phase 2.",
        required_permissions: ["x:run"],
        evidence_env_keys: [],
        notes: "no probe",
      },
    ];

    const result = await runCapabilityPreflight({
      intake_id: INTAKE,
      capability_families: ["automation"],
      operational_risk: "L0",
      registry,
    });

    expect(result.user_diy_allowed).toBe(true);
    expect(["no_tool_user_may_diy", "incomplete_evidence"]).toContain(result.overall_status);
  });

  it("names connector + connect_instructions when registered but not connected", async () => {
    process.env.NOTION_ADAPTER = "http";
    delete process.env.NOTION_TOKEN;
    delete process.env.NOTION_MISSIONS_DATABASE_ID;

    const registry: ToolRegistry = [
      {
        tool_id: "tool:notion-mission-registry",
        display_name: "Notion Mission Registry",
        kind: "connector",
        capability_families: ["knowledge_management"],
        adapter_id: "adapter:notion",
        enabled: true,
        connect_instructions: "Set NOTION_TOKEN and NOTION_MISSIONS_DATABASE_ID.",
        required_permissions: ["notion:databases:read", "notion:pages:write"],
        evidence_env_keys: ["NOTION_ADAPTER", "NOTION_TOKEN", "NOTION_MISSIONS_DATABASE_ID"],
      },
    ];

    const result = await runCapabilityPreflight({
      intake_id: INTAKE,
      capability_families: ["knowledge_management"],
      operational_risk: "L1",
      registry,
    });

    expect(result.overall_status).toBe("blocked_connector");
    expect(result.user_diy_allowed).toBe(false);
    expect(result.evidence_summary).toContain("Notion Mission Registry");
    expect(result.tools[0]?.connect_instructions).toContain("NOTION_TOKEN");
  });

  it("lists missing_permissions when config present but authority not evidenced", async () => {
    process.env.NOTION_ADAPTER = "http";
    process.env.NOTION_TOKEN = "secret-not-logged";
    process.env.NOTION_MISSIONS_DATABASE_ID = "db-test";

    const registry: ToolRegistry = [
      {
        tool_id: "tool:notion-mission-registry",
        display_name: "Notion Mission Registry",
        kind: "connector",
        capability_families: ["knowledge"],
        adapter_id: "adapter:notion",
        enabled: true,
        connect_instructions: "Connect Notion.",
        required_permissions: ["notion:databases:read", "notion:pages:write"],
        evidence_env_keys: ["NOTION_ADAPTER", "NOTION_TOKEN", "NOTION_MISSIONS_DATABASE_ID"],
      },
    ];

    const result = await runCapabilityPreflight({
      intake_id: INTAKE,
      capability_families: ["knowledge"],
      operational_risk: "L1",
      registry,
    });

    const notion = result.tools[0]!;
    expect(notion.connection_status).toBe("connected_unverified");
    expect(notion.missing_permissions.length).toBeGreaterThan(0);
    expect(result.overall_status).toBe("blocked_permissions");
    expect(result.user_diy_allowed).toBe(false);
    expect(result.evidence_summary).toContain("missing_permissions");
  });

  it("high risk requires authority approval even when a tool is ready", async () => {
    expect(riskRequiresAuthorityApproval("L3")).toBe(true);
    expect(riskRequiresAuthorityApproval("L0")).toBe(false);

    const result = await runCapabilityPreflight({
      intake_id: INTAKE,
      capability_families: ["docs"],
      operational_risk: "L4",
    });

    expect(result.requires_authority_approval).toBe(true);
    expect(result.overall_status).toBe("requires_approval");
    expect(result.user_diy_allowed).toBe(false);
  });
});

describe("Preflight wired into analyzeIntake", () => {
  const tmpRoot = path.join(process.cwd(), ".data-test-preflight");

  async function resetRepo() {
    await fs.rm(tmpRoot, { recursive: true, force: true });
    const repo = new DevFileRepository(tmpRoot);
    globalThis.__aiposRepo = repo;
    globalThis.__aiposPersistenceMode = "dev-file";
    return repo;
  }

  beforeEach(async () => {
    process.env.ANALYZE_PROVIDER = "none";
    process.env.NOTION_ADAPTER = "mock";
    clearToolRegistryCache();
    await resetRepo();
  });

  afterEach(async () => {
    clearToolRegistryCache();
    globalThis.__aiposRepo = undefined;
    await fs.rm(tmpRoot, { recursive: true, force: true });
  });

  it("stores preflight knowledge_ref and audit evidence on analyze", async () => {
    const { bundle } = await createIntake(
      {
        raw_request: "Please summarize this document for the team",
        idempotency_key: `IDEM-PF-${Date.now()}`,
      },
      "operator:test",
    );

    const analyzed = await analyzeIntake(bundle.intake_id, "operator:test");
    const ref = analyzed.knowledge_refs.find(
      (r) => (r as { kind?: string }).kind === "preflight",
    ) as
      | { kind: string; preflight_id: string; overall_status: string; user_diy_allowed: boolean }
      | undefined;

    expect(ref).toBeTruthy();
    expect(ref!.preflight_id).toMatch(/^PF-/);
    expect(ref!.overall_status).toBeTruthy();

    const audits = await getRepository().listAudit({ intake_id: bundle.intake_id });
    const pf = audits.find((a) => a.action === "preflight:capability_connection_authority");
    expect(pf).toBeTruthy();
    expect(pf!.policy_result).toMatchObject({
      preflight_id: ref!.preflight_id,
    });
    expect(
      (pf!.policy_result as { tool_selection?: unknown[] }).tool_selection?.length,
    ).toBeGreaterThan(0);
  });
});
