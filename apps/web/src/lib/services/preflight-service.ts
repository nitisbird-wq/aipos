import { promises as fs } from "fs";
import path from "path";
import type { IntakeMissionBundle } from "@/lib/schemas/intake";
import {
  AuthorityStatusSchema,
  ConnectionStatusSchema,
  PreflightResultSchema,
  ToolRegistryEntrySchema,
  type AuthorityStatus,
  type ConnectionStatus,
  type PreflightResult,
  type ToolRegistryEntry,
} from "@/lib/schemas/preflight";
import { nowIso } from "@/lib/ids";

function workspaceRoot(): string {
  // apps/web → repo root
  return path.resolve(process.cwd(), "../..");
}

export async function loadToolRegistry(root = workspaceRoot()): Promise<ToolRegistryEntry[]> {
  const file = path.join(root, "data", "seeds", "tool-registry.json");
  const raw = JSON.parse(await fs.readFile(file, "utf8")) as unknown;
  return ToolRegistryEntrySchema.array().parse(raw);
}

function envPresent(key: string): boolean {
  const v = process.env[key];
  return typeof v === "string" && v.trim().length > 0;
}

/**
 * Probe connection with epistemic honesty.
 * Never sets claims.connected / claims.verified without probe evidence.
 * credential_present and mock_only are explicitly NOT Connected/Verified.
 */
export function probeToolConnection(tool: ToolRegistryEntry): ConnectionStatus {
  const probed_at = nowIso();
  const keys = tool.credential_env_keys ?? [];

  if (tool.tool_id === "tool:notion") {
    const mode = (process.env.NOTION_ADAPTER || "mock").toLowerCase();
    if (mode === "mock") {
      return ConnectionStatusSchema.parse({
        tool_id: tool.tool_id,
        status: "mock_only",
        probed_at,
        evidence: {
          method: "adapter_mode",
          summary: "NOTION_ADAPTER=mock — mock_synced path only; not external_verified",
          probe_id: null,
          adapter_mode: "mock",
        },
        claims: { connected: false, verified: false },
        connect_instructions: tool.connect_instructions,
        error: null,
      });
    }
    const present = keys.filter(envPresent);
    if (present.length < keys.length) {
      return ConnectionStatusSchema.parse({
        tool_id: tool.tool_id,
        status: "not_configured",
        probed_at,
        evidence: {
          method: "env_presence",
          summary: `Missing Notion credentials: ${keys.filter((k) => !envPresent(k)).join(", ")}`,
          probe_id: null,
          adapter_mode: mode,
          env_keys_present: present,
        },
        claims: { connected: false, verified: false },
        connect_instructions: tool.connect_instructions,
        error: null,
      });
    }
    // Token present is not Verified — no live readback in Phase 2 preflight.
    return ConnectionStatusSchema.parse({
      tool_id: tool.tool_id,
      status: "credential_present",
      probed_at,
      evidence: {
        method: "env_presence",
        summary:
          "Notion credentials present; Verified requires successful page readback (not claimed here)",
        probe_id: null,
        adapter_mode: mode,
        env_keys_present: present,
      },
      claims: { connected: false, verified: false },
      connect_instructions: tool.connect_instructions,
      error: null,
    });
  }

  if (keys.length === 0) {
    return ConnectionStatusSchema.parse({
      tool_id: tool.tool_id,
      status: "not_configured",
      probed_at,
      evidence: {
        method: "none",
        summary:
          "No credential probe configured for this tool in Phase 2; treat as not ready for dispatch",
        probe_id: null,
      },
      claims: { connected: false, verified: false },
      connect_instructions: tool.connect_instructions,
      error: null,
    });
  }

  const present = keys.filter(envPresent);
  if (present.length === 0) {
    return ConnectionStatusSchema.parse({
      tool_id: tool.tool_id,
      status: "not_configured",
      probed_at,
      evidence: {
        method: "env_presence",
        summary: `No credentials configured (${keys.join(", ")})`,
        probe_id: null,
        env_keys_present: [],
      },
      claims: { connected: false, verified: false },
      connect_instructions: tool.connect_instructions,
      error: null,
    });
  }

  return ConnectionStatusSchema.parse({
    tool_id: tool.tool_id,
    status: "credential_present",
    probed_at,
    evidence: {
      method: "env_presence",
      summary:
        "Credential env present — not Connected/Authorized/Verified without live probe + grant evidence",
      probe_id: null,
      env_keys_present: present,
    },
    claims: { connected: false, verified: false },
    connect_instructions: tool.connect_instructions,
    error: null,
  });
}

/**
 * Authority assessment. Authorized only with grant_evidence.
 * L3–L4 always require authority_approval even if credentials exist.
 */
export function assessToolAuthority(
  tool: ToolRegistryEntry,
  connection: ConnectionStatus,
  operationalRisk: IntakeMissionBundle["operational_risk"],
): AuthorityStatus {
  const assessed_at = nowIso();
  const highRisk = operationalRisk === "L3" || operationalRisk === "L4";
  const required_approvals = highRisk ? ["authority_approval"] : [];

  if (
    connection.status === "not_configured" ||
    connection.status === "disconnected" ||
    connection.status === "unknown" ||
    connection.status === "error"
  ) {
    return AuthorityStatusSchema.parse({
      tool_id: tool.tool_id,
      status: "not_authorized",
      missing_permissions: [...tool.required_permissions],
      required_approvals,
      claims: { authorized: false },
      grant_evidence: null,
      assessed_at,
      notes: "Tool not connected; cannot authorize",
    });
  }

  if (connection.status === "mock_only") {
    return AuthorityStatusSchema.parse({
      tool_id: tool.tool_id,
      status: "insufficient",
      missing_permissions: [...tool.required_permissions],
      required_approvals,
      claims: { authorized: false },
      grant_evidence: null,
      assessed_at,
      notes: "Mock adapter is not an authorization grant for external action",
    });
  }

  if (connection.status === "credential_present") {
    // Credentials ≠ permission grant evidence in Phase 2.
    return AuthorityStatusSchema.parse({
      tool_id: tool.tool_id,
      status: highRisk ? "requires_approval" : "insufficient",
      missing_permissions: [...tool.required_permissions],
      required_approvals,
      claims: { authorized: false },
      grant_evidence: null,
      assessed_at,
      notes:
        "Credential presence is not permission grant evidence; live authorization probe deferred to later phase",
    });
  }

  if (connection.status === "connected" && highRisk) {
    return AuthorityStatusSchema.parse({
      tool_id: tool.tool_id,
      status: "requires_approval",
      missing_permissions: [],
      required_approvals,
      claims: { authorized: false },
      grant_evidence: null,
      assessed_at,
      notes: "High-risk mission requires Authority Approval even when tool is connected",
    });
  }

  // connected + grant would be authorized — Phase 2 probes do not produce connected yet.
  return AuthorityStatusSchema.parse({
    tool_id: tool.tool_id,
    status: "unknown",
    missing_permissions: [...tool.required_permissions],
    required_approvals,
    claims: { authorized: false },
    grant_evidence: null,
    assessed_at,
    notes: "No grant evidence available",
  });
}

function candidatesForBundle(
  registry: ToolRegistryEntry[],
  bundle: IntakeMissionBundle,
): ToolRegistryEntry[] {
  const families = new Set(bundle.capability_families);
  const enabled = registry.filter((t) => t.enabled);
  if (families.size === 0) {
    // Still evaluate core support tools so we never skip Preflight.
    return enabled.filter(
      (t) => t.tool_id === "tool:notion" || t.execution_phase === "intake_support",
    );
  }
  return enabled.filter((t) => {
    const fams = t.capability_families ?? [];
    return fams.some((f) => families.has(f)) || t.tool_id === "tool:notion";
  });
}

export type RunPreflightInput = {
  bundle: IntakeMissionBundle;
  missionId: string | null;
  registry?: ToolRegistryEntry[];
  preflightId?: string;
};

/**
 * Capability–Connection–Authority Preflight (Phase 2 Core Control).
 * Runs before Assignment/Execution. Does not dispatch specialists or n8n.
 */
export async function runCapabilityPreflight(input: RunPreflightInput): Promise<PreflightResult> {
  const registry = input.registry ?? (await loadToolRegistry());
  const candidates = candidatesForBundle(registry, input.bundle);
  const connection_results = candidates.map(probeToolConnection);
  const authority_results = candidates.map((tool, i) =>
    assessToolAuthority(tool, connection_results[i]!, input.bundle.operational_risk),
  );

  const byId = new Map(candidates.map((t) => [t.tool_id, t]));
  const connById = new Map(connection_results.map((c) => [c.tool_id, c]));
  const authById = new Map(authority_results.map((a) => [a.tool_id, a]));

  const any_connected = connection_results.some((c) => c.claims.connected);
  const any_authorized = authority_results.some((a) => a.claims.authorized);
  const any_verified = connection_results.some((c) => c.claims.verified);

  // Prefer tools that are actually ready; otherwise prioritize connect over manual.
  const readyTool = candidates.find((t) => {
    const c = connById.get(t.tool_id)!;
    const a = authById.get(t.tool_id)!;
    return c.claims.connected && a.claims.authorized && a.status === "authorized";
  });

  const needsConnect = candidates.filter((t) => {
    const c = connById.get(t.tool_id)!;
    return (
      c.status === "not_configured" ||
      c.status === "disconnected" ||
      c.status === "mock_only" ||
      c.status === "credential_present"
    );
  });

  const needsPermission = candidates.filter((t) => {
    const a = authById.get(t.tool_id)!;
    const c = connById.get(t.tool_id)!;
    return (
      (c.status === "credential_present" || c.status === "connected") &&
      (a.status === "insufficient" || a.status === "not_authorized") &&
      a.missing_permissions.length > 0
    );
  });

  const needsApproval = candidates.filter((t) => {
    const a = authById.get(t.tool_id)!;
    return a.status === "requires_approval" || a.required_approvals.length > 0;
  });

  const highRisk = input.bundle.operational_risk === "L3" || input.bundle.operational_risk === "L4";

  let disposition: PreflightResult["disposition"];
  let selected_tool_id: string | null = null;
  let selection_reason: string;
  const user_actions: PreflightResult["user_actions"] = [];
  const blocking_codes: string[] = [];
  let manual_allowed = false;
  let manual_reason = "Manual fallback not allowed until no capable tool is proven ready";

  if (readyTool) {
    if (highRisk) {
      disposition = "approval_required";
      selected_tool_id = readyTool.tool_id;
      selection_reason = `Tool ${readyTool.tool_id} is ready but operational_risk=${input.bundle.operational_risk} requires Authority Approval`;
      blocking_codes.push("APPROVAL_REQUIRED");
      user_actions.push({
        code: "OBTAIN_APPROVAL",
        tool_id: readyTool.tool_id,
        message: `Obtain authority_approval before Assignment/Execution (risk ${input.bundle.operational_risk})`,
        connect_instructions: null,
      });
    } else {
      disposition = "ready_for_assignment";
      selected_tool_id = readyTool.tool_id;
      selection_reason = `Selected ${readyTool.tool_id} with evidenced connection + authorization`;
      user_actions.push({
        code: "WAIT_PHASE3_EXECUTION",
        tool_id: readyTool.tool_id,
        message:
          "Preflight passed for later Assignment/Execution (Phase 3). No specialist dispatch in Phase 2.",
        connect_instructions: null,
      });
    }
  } else if (needsConnect.length > 0) {
    // Prefer connect guidance over asking the user to do the work.
    const primary =
      needsConnect.find((t) =>
        (t.capability_families ?? []).some((f) => input.bundle.capability_families.includes(f)),
      ) ?? needsConnect[0]!;
    disposition = "connect_required";
    selected_tool_id = primary.tool_id;
    selection_reason = `Connector ${primary.tool_id} can serve this mission but is not evidenced as Connected/Authorized`;
    blocking_codes.push("CONNECT_REQUIRED");
    user_actions.push({
      code: "CONNECT_TOOL",
      tool_id: primary.tool_id,
      message: `Connect ${primary.display_name} before Assignment/Execution. Do not perform the specialist work manually until connectors are unavailable.`,
      connect_instructions: primary.connect_instructions,
    });
    // Also surface permission gaps when credentials partially present.
    for (const t of needsPermission.slice(0, 3)) {
      const a = authById.get(t.tool_id)!;
      user_actions.push({
        code: "GRANT_PERMISSION",
        tool_id: t.tool_id,
        missing_permissions: a.missing_permissions,
        message: `Grant missing permissions for ${t.display_name}: ${a.missing_permissions.join(", ")}`,
        connect_instructions: null,
      });
      blocking_codes.push("PERMISSION_REQUIRED");
    }
  } else if (needsPermission.length > 0) {
    const primary = needsPermission[0]!;
    const a = authById.get(primary.tool_id)!;
    disposition = "permission_required";
    selected_tool_id = primary.tool_id;
    selection_reason = `Tool ${primary.tool_id} lacks evidenced permissions`;
    blocking_codes.push("PERMISSION_REQUIRED");
    user_actions.push({
      code: "GRANT_PERMISSION",
      tool_id: primary.tool_id,
      missing_permissions: a.missing_permissions,
      message: `Missing permissions: ${a.missing_permissions.join(", ")}`,
      connect_instructions: null,
    });
  } else if (highRisk && needsApproval.length > 0) {
    disposition = "approval_required";
    selected_tool_id = needsApproval[0]!.tool_id;
    selection_reason = "High-risk mission requires Authority Approval";
    blocking_codes.push("APPROVAL_REQUIRED");
    user_actions.push({
      code: "OBTAIN_APPROVAL",
      tool_id: selected_tool_id,
      message: "Authority Approval required for L3–L4 before Assignment/Execution",
      connect_instructions: null,
    });
  } else if (candidates.length === 0 || candidates.every((t) => t.allows_manual_fallback)) {
    // Proven: no ready tool (none connected+authorized). Manual may be allowed.
    const allows = candidates.length === 0 || candidates.some((t) => t.allows_manual_fallback);
    if (allows) {
      disposition = "manual_fallback_allowed";
      selected_tool_id = null;
      selection_reason =
        "No Tool/Connector/Agent is evidenced as Connected and Authorized for these capabilities";
      manual_allowed = true;
      manual_reason =
        "Preflight proved no ready acting tool; manual fallback permitted by registry allows_manual_fallback";
      blocking_codes.push("NO_READY_TOOL");
      user_actions.push({
        code: "NO_TOOL_USE_MANUAL",
        tool_id: null,
        message:
          "No ready connector/agent found after Preflight. Manual work is allowed only because no acting tool is available.",
        connect_instructions: null,
      });
    } else {
      disposition = "blocked";
      selected_tool_id = null;
      selection_reason = "No ready tool and manual fallback forbidden";
      blocking_codes.push("BLOCKED_NO_TOOL");
      user_actions.push({
        code: "NONE",
        tool_id: null,
        message: "Mission Assignment/Execution blocked — no tool and no manual fallback",
        connect_instructions: null,
      });
    }
  } else {
    disposition = "blocked";
    selected_tool_id = null;
    selection_reason = "Preflight could not establish a ready acting tool";
    blocking_codes.push("BLOCKED");
    user_actions.push({
      code: "NONE",
      message: "Assignment/Execution blocked pending tool readiness",
      tool_id: null,
      connect_instructions: null,
    });
  }

  // Suppress unused lint for byId in edge paths
  void byId;

  const result: PreflightResult = PreflightResultSchema.parse({
    preflight_id:
      input.preflightId ?? `PF-${crypto.randomUUID().replace(/-/g, "").slice(0, 12).toUpperCase()}`,
    schema_version: "1.0.0",
    intake_id: input.bundle.intake_id,
    mission_id: input.missionId,
    evaluated_at: nowIso(),
    operational_risk: input.bundle.operational_risk,
    capability_families: [...input.bundle.capability_families],
    candidate_tools: candidates.map((t) => t.tool_id),
    connection_results,
    authority_results,
    selected_tool_id,
    selection_reason,
    disposition,
    user_actions,
    manual_fallback: {
      allowed: manual_allowed,
      reason: manual_reason,
    },
    claims: {
      any_connected,
      any_authorized,
      any_verified,
    },
    blocking_codes: Array.from(new Set(blocking_codes)),
    assignment_execution_blocked: disposition !== "ready_for_assignment",
  });

  return result;
}
