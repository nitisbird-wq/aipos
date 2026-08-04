import { readFile } from "node:fs/promises";
import path from "node:path";
import type { OperationalRisk } from "@/lib/schemas/intake";
import {
  PreflightResultSchema,
  ToolRegistrySchema,
  type AuthorityStatus,
  type ConnectionStatus,
  type PreflightResult,
  type PreflightToolResult,
  type ToolRegistry,
  type ToolRegistryEntry,
} from "@/lib/schemas/preflight";
import { newPreflightId, nowIso } from "@/lib/ids";

let cachedRegistry: ToolRegistry | null = null;

export function clearToolRegistryCache(): void {
  cachedRegistry = null;
}

export async function loadToolRegistry(): Promise<ToolRegistry> {
  if (cachedRegistry) return cachedRegistry;
  const candidates = [
    path.resolve(process.cwd(), "../../data/seeds", "tools.json"),
    path.resolve(process.cwd(), "data/seeds", "tools.json"),
    path.resolve(process.cwd(), "../data/seeds", "tools.json"),
    path.resolve(process.cwd(), "../../../data/seeds", "tools.json"),
  ];
  for (const p of candidates) {
    try {
      const raw = await readFile(p, "utf8");
      cachedRegistry = ToolRegistrySchema.parse(JSON.parse(raw));
      return cachedRegistry;
    } catch {
      /* try next */
    }
  }
  throw new Error("Tool registry seed data/seeds/tools.json not found");
}

/** Env presence only — never log values. */
function envPresent(key: string): boolean {
  const v = process.env[key];
  return typeof v === "string" && v.trim().length > 0;
}

function notionAdapterMode(): string {
  return (process.env.NOTION_ADAPTER || "mock").trim().toLowerCase();
}

function analyzeProvider(): string {
  return (process.env.ANALYZE_PROVIDER || "none").trim().toLowerCase();
}

/**
 * High operational risk still requires policy/authority approval even when a tool is ready.
 * L3+ = high; L4 = critical (Architecture Contract / intake risk ladder).
 */
export function riskRequiresAuthorityApproval(risk: OperationalRisk): boolean {
  return risk === "L3" || risk === "L4";
}

function familiesOverlap(toolFamilies: string[], required: string[]): boolean {
  if (required.length === 0) return true;
  const req = new Set(required);
  // Alias: analyze emits knowledge_management; registry may use knowledge
  if (req.has("knowledge_management")) req.add("knowledge");
  if (req.has("knowledge")) req.add("knowledge_management");
  return toolFamilies.some((f) => req.has(f));
}

type EvalContext = {
  requiresApproval: boolean;
};

function evaluateTool(entry: ToolRegistryEntry, ctx: EvalContext): PreflightToolResult {
  const evidence: string[] = [];
  const missing_permissions: string[] = [];
  let connection_status: ConnectionStatus = "unknown_unverified";
  let authority_status: AuthorityStatus = "unknown_unverified";
  let selection_reason = "not_selected";

  if (!entry.enabled) {
    return {
      tool_id: entry.tool_id,
      display_name: entry.display_name,
      connection_status: "not_registered",
      authority_status: "policy_blocked",
      missing_permissions: [],
      connect_instructions: entry.connect_instructions,
      selection_reason: "tool_disabled_in_registry",
      evidence: ["enabled=false"],
    };
  }

  const envKeys = entry.evidence_env_keys ?? [];
  const presentKeys = envKeys.filter((k) => envPresent(k));
  if (envKeys.length > 0) {
    evidence.push(
      `env_keys_present=${presentKeys.length}/${envKeys.length} (names only; values not logged)`,
    );
  }

  // --- per-tool honest probes (Phase 2: no live remote permission API) ---
  if (entry.tool_id === "tool:analyze-heuristic") {
    const provider = analyzeProvider();
    evidence.push(`ANALYZE_PROVIDER=${provider || "none"}`);
    evidence.push("local_runtime_in_process=true");
    connection_status = "ready_evidenced";
    authority_status = "not_applicable";
    selection_reason = "local_heuristic_ready_for_intake_analyze";
  } else if (entry.tool_id === "tool:openai-analyze") {
    const provider = analyzeProvider();
    const hasKey = envPresent("OPENAI_API_KEY");
    evidence.push(`ANALYZE_PROVIDER=${provider}`);
    evidence.push(`OPENAI_API_KEY_present=${hasKey}`);
    if (provider === "openai" && hasKey) {
      // Key present ≠ Verified authority / live probe
      connection_status = "connected_unverified";
      authority_status = "unknown_unverified";
      missing_permissions.push(...entry.required_permissions);
      selection_reason =
        "openai_key_present_but_no_live_permission_probe; not claiming Authorized/Verified";
      evidence.push("no_live_openai_permission_probe");
    } else {
      connection_status = "not_connected";
      authority_status = "insufficient_permissions";
      missing_permissions.push(...entry.required_permissions);
      selection_reason = "openai_analyze_not_configured";
    }
  } else if (entry.tool_id === "tool:notion-mission-registry") {
    const mode = notionAdapterMode();
    evidence.push(`NOTION_ADAPTER=${mode}`);
    if (mode === "mock") {
      connection_status = "mock_only";
      authority_status = "not_applicable";
      selection_reason = "mock_adapter_never_connected_or_verified";
      evidence.push("mock_is_not_Connected_Authorized_or_Verified");
    } else if (envPresent("NOTION_TOKEN") && envPresent("NOTION_MISSIONS_DATABASE_ID")) {
      connection_status = "connected_unverified";
      authority_status = "unknown_unverified";
      missing_permissions.push(...entry.required_permissions);
      selection_reason =
        "notion_token_present_but_no_verified_readback_probe; not claiming Connected/Authorized/Verified";
      evidence.push("no_notion_verified_readback_in_preflight");
    } else {
      connection_status = "not_connected";
      authority_status = "insufficient_permissions";
      missing_permissions.push(...entry.required_permissions);
      if (!envPresent("NOTION_TOKEN")) missing_permissions.push("notion:token");
      if (!envPresent("NOTION_MISSIONS_DATABASE_ID")) {
        missing_permissions.push("notion:missions_database_id");
      }
      selection_reason = "notion_connector_registered_but_not_connected";
    }
  } else if (entry.tool_id === "tool:n8n-execution" || entry.tool_id === "tool:cursor-agent") {
    connection_status = "unknown_unverified";
    authority_status = "unknown_unverified";
    missing_permissions.push(...entry.required_permissions);
    selection_reason = "phase_2_no_live_adapter_probe; not eligible for dispatch";
    evidence.push("phase_2_preflight_only; execution/specialist adapters out of scope");
  } else {
    // Generic registry entry: env presence → unverified at best
    if (envKeys.length > 0 && presentKeys.length === envKeys.length) {
      connection_status = "connected_unverified";
      authority_status = "unknown_unverified";
      missing_permissions.push(...entry.required_permissions);
      selection_reason = "config_present_without_live_probe";
    } else if (envKeys.length > 0) {
      connection_status = "not_connected";
      authority_status = "insufficient_permissions";
      missing_permissions.push(...entry.required_permissions);
      selection_reason = "required_env_keys_missing";
    } else {
      connection_status = "unknown_unverified";
      authority_status = "unknown_unverified";
      missing_permissions.push(...entry.required_permissions);
      selection_reason = "no_evidence_probe_defined";
    }
  }

  if (ctx.requiresApproval && connection_status === "ready_evidenced") {
    if (authority_status === "not_applicable") {
      authority_status = "requires_human_approval";
    }
    selection_reason = `${selection_reason}; high_risk_requires_authority_approval`;
    evidence.push("mission_risk_requires_policy_approval_before_acting");
  }

  return {
    tool_id: entry.tool_id,
    display_name: entry.display_name,
    connection_status,
    authority_status,
    missing_permissions: [...new Set(missing_permissions)],
    connect_instructions: entry.connect_instructions,
    selection_reason,
    evidence,
  };
}

function isActionReady(t: PreflightToolResult): boolean {
  return (
    t.connection_status === "ready_evidenced" &&
    (t.authority_status === "not_applicable" ||
      t.authority_status === "authorized_evidenced" ||
      t.authority_status === "requires_human_approval")
  );
}

function decide(
  matched: PreflightToolResult[],
  allEvaluated: PreflightToolResult[],
  requiresApproval: boolean,
): Pick<
  PreflightResult,
  | "user_diy_allowed"
  | "user_diy_reason"
  | "requires_authority_approval"
  | "overall_status"
  | "evidence_summary"
> {
  const ready = matched.filter(isActionReady);

  if (ready.length > 0) {
    if (requiresApproval) {
      return {
        user_diy_allowed: false,
        user_diy_reason:
          "DIY not offered: at least one tool is ready; high-risk missions require authority approval first",
        requires_authority_approval: true,
        overall_status: "requires_approval",
        evidence_summary: `ready_tools=[${ready.map((t) => t.tool_id).join(",")}]; awaiting_authority_approval`,
      };
    }
    return {
      user_diy_allowed: false,
      user_diy_reason: "DIY not allowed while a ready tool can act for the user",
      requires_authority_approval: false,
      overall_status: "ready_with_tools",
      evidence_summary: `selected_ready_tools=[${ready.map((t) => t.tool_id).join(",")}]; reasons=[${ready
        .map((t) => t.selection_reason)
        .join(" | ")}]`,
    };
  }

  const blockedConnector = matched.find((t) => t.connection_status === "not_connected");
  if (blockedConnector) {
    return {
      user_diy_allowed: false,
      user_diy_reason:
        "DIY not allowed: a registered connector/tool exists but is not connected — connect it before asking the user to DIY",
      requires_authority_approval: requiresApproval,
      overall_status: "blocked_connector",
      evidence_summary: `connector=${blockedConnector.display_name} (${blockedConnector.tool_id}); connect: ${blockedConnector.connect_instructions}`,
    };
  }

  const blockedPerm = matched.find(
    (t) => t.connection_status === "connected_unverified" && t.missing_permissions.length > 0,
  );
  if (blockedPerm) {
    return {
      user_diy_allowed: false,
      user_diy_reason:
        "DIY not allowed: tool path exists but permissions are insufficient — grant missing permissions first",
      requires_authority_approval: requiresApproval,
      overall_status: "blocked_permissions",
      evidence_summary: `tool=${blockedPerm.display_name}; missing_permissions=[${blockedPerm.missing_permissions.join(",")}]`,
    };
  }

  // Mock-only / unknown / incomplete — if nothing can act with evidence
  const anyIncomplete = matched.every(
    (t) =>
      t.connection_status === "mock_only" ||
      t.connection_status === "unknown_unverified" ||
      t.connection_status === "connected_unverified" ||
      t.connection_status === "not_registered",
  );

  if (matched.length === 0) {
    return {
      user_diy_allowed: true,
      user_diy_reason:
        "No registered tool matches required capability families after registry scan — user may DIY",
      requires_authority_approval: requiresApproval,
      overall_status: "no_tool_user_may_diy",
      evidence_summary: `evaluated_registry_tools=${allEvaluated.length}; matched=0`,
    };
  }

  if (anyIncomplete && !matched.some(isActionReady)) {
    // Proven no ready evidenced tool → DIY allowed (requirement 3)
    return {
      user_diy_allowed: true,
      user_diy_reason:
        "No tool has ready_evidenced connection+authority after Capability–Connection–Authority checks — user may DIY",
      requires_authority_approval: requiresApproval,
      overall_status: matched.some((t) => t.connection_status === "connected_unverified")
        ? "incomplete_evidence"
        : "no_tool_user_may_diy",
      evidence_summary: `matched_tools=[${matched
        .map((t) => `${t.tool_id}:${t.connection_status}/${t.authority_status}`)
        .join("; ")}]`,
    };
  }

  return {
    user_diy_allowed: true,
    user_diy_reason: "No ready tool path after preflight — user may DIY",
    requires_authority_approval: requiresApproval,
    overall_status: "no_tool_user_may_diy",
    evidence_summary: `matched=${matched.length}`,
  };
}

export type RunPreflightInput = {
  intake_id: string;
  capability_families: string[];
  operational_risk: OperationalRisk;
  registry?: ToolRegistry;
  now?: string;
};

/**
 * Capability–Connection–Authority Preflight (AIPOS Core Control).
 * Runs before Assignment/Execution. Never claims Connected/Authorized/Verified without evidence.
 */
export async function runCapabilityPreflight(input: RunPreflightInput): Promise<PreflightResult> {
  const registry = input.registry ?? (await loadToolRegistry());
  const requiresApproval = riskRequiresAuthorityApproval(input.operational_risk);
  const ctx: EvalContext = { requiresApproval };

  const allEvaluated = registry.map((entry) => evaluateTool(entry, ctx));
  const matchedEntries = registry.filter((e) =>
    familiesOverlap(e.capability_families, input.capability_families),
  );
  const matched = matchedEntries.map((entry) => {
    const full = allEvaluated.find((t) => t.tool_id === entry.tool_id)!;
    return {
      ...full,
      selection_reason: full.selection_reason.startsWith("not_selected")
        ? `capability_match; ${full.selection_reason}`
        : `capability_match; ${full.selection_reason}`,
    };
  });

  // Prefer showing matched tools; if none matched, still surface registry scan for audit
  const toolsForResult = matched.length > 0 ? matched : allEvaluated;
  const decision = decide(matched, allEvaluated, requiresApproval);

  const result: PreflightResult = {
    preflight_id: newPreflightId(),
    intake_id: input.intake_id,
    evaluated_at: input.now ?? nowIso(),
    capability_families: input.capability_families,
    tools: toolsForResult,
    ...decision,
  };

  return PreflightResultSchema.parse(result);
}
