import capabilitiesSeed from "../../../../../data/seeds/capabilities.json";
import type { OperatorId, WorkstreamRisk } from "@/lib/schemas/workstream";
import { evaluateRiskAutonomy } from "@/lib/orchestration/risk-autonomy";

type SeedSpecialist = {
  specialist_id: string;
  score: number;
  adapter_id?: string;
  enabled?: boolean;
};

type SeedCapability = {
  capability_id: string;
  family: string;
  enabled?: boolean;
  status?: string;
  human_review_required?: boolean;
  auto_route_enabled?: boolean;
  specialists?: SeedSpecialist[];
};

const OPERATOR_ALIASES: Record<string, OperatorId> = {
  claude: "claude",
  cursor: "cursor",
  n8n: "n8n",
  notion: "notion",
  human: "human",
  gpt: "claude", // interim: OpenAI intake path is not a Phase 3 operator family
  gemini: "claude",
};

export type CapabilityRouteInput = {
  workstream_id: string;
  mission_id: string;
  required_capabilities: string[];
  risk_level: WorkstreamRisk;
  tools_required?: string[];
  acceptance_criteria: string[];
  expected_artifact: { type: string; location_hint?: string; description?: string };
  correlation_id: string;
  reversible?: boolean;
  within_delegated_authority?: boolean;
  involves_secrets?: boolean;
  involves_production_change?: boolean;
  involves_merge_or_deploy?: boolean;
  irreversible?: boolean;
  sensitive_external_write?: boolean;
  /** Operator credential verification map; missing => unverified */
  operator_credentials?: Partial<Record<OperatorId, boolean>>;
  decided_at?: string;
};

function seedCapabilities(): SeedCapability[] {
  return capabilitiesSeed as SeedCapability[];
}

function mapOperator(specialistId: string): OperatorId | null {
  return OPERATOR_ALIASES[specialistId] ?? null;
}

/**
 * Capability Router (ADR-006): capabilities → eligible operators → primary.
 * Does not hard-code a single operator name as the routing key.
 */
export function routeWorkstreamCapabilities(input: CapabilityRouteInput) {
  const caps = seedCapabilities();
  const unknown: string[] = [];
  const domainUnvalidated: string[] = [];
  const eligibleScores = new Map<
    OperatorId,
    { score: number; credential_verified: boolean; reasons: string[] }
  >();

  for (const capId of input.required_capabilities) {
    const cap = caps.find((c) => c.capability_id === capId);
    if (!cap || cap.enabled === false) {
      unknown.push(capId);
      continue;
    }
    if (capId.startsWith("domain.") || cap.status === "unvalidated" || cap.human_review_required) {
      domainUnvalidated.push(capId);
    }
    for (const spec of cap.specialists ?? []) {
      if (spec.enabled === false) continue;
      const op = mapOperator(spec.specialist_id);
      if (!op) continue;
      const verified = input.operator_credentials?.[op] === true;
      const prev = eligibleScores.get(op);
      const nextScore = Math.max(prev?.score ?? 0, spec.score);
      const reasons = new Set(prev?.reasons ?? []);
      reasons.add(`${capId}→${spec.specialist_id} score ${spec.score}`);
      eligibleScores.set(op, {
        score: nextScore,
        credential_verified: verified,
        reasons: Array.from(reasons),
      });
    }
  }

  const eligible_operators = Array.from(eligibleScores.entries())
    .map(([operator, v]) => ({
      operator,
      score: v.score,
      credential_verified: v.credential_verified,
      reasons: v.reasons,
    }))
    .sort((a, b) => b.score - a.score || a.operator.localeCompare(b.operator));

  const verifiedEligible = eligible_operators.filter((e) => e.credential_verified);
  const humanVerified = input.operator_credentials?.human === true;
  const hasDomain = domainUnvalidated.length > 0;
  const primary = hasDomain
    ? humanVerified
      ? "human"
      : (verifiedEligible[0]?.operator ?? "unassigned")
    : (verifiedEligible[0]?.operator ?? "unassigned");
  const supporting =
    verifiedEligible.find((e) => e.operator !== primary)?.operator ??
    eligible_operators.find((e) => e.operator !== primary)?.operator ??
    null;

  const autonomy = evaluateRiskAutonomy({
    risk_level: input.risk_level,
    required_capabilities: input.required_capabilities,
    has_unknown_capability: unknown.length > 0,
    // Domain/unvalidated capabilities escalate to Human; do not fail solely for empty specialist lists.
    has_eligible_verified_operator: hasDomain
      ? humanVerified || verifiedEligible.length > 0
      : verifiedEligible.length > 0,
    authority_known: true,
    reversible: input.reversible,
    within_delegated_authority: input.within_delegated_authority,
    involves_secrets: input.involves_secrets,
    involves_production_change: input.involves_production_change,
    involves_merge_or_deploy: input.involves_merge_or_deploy,
    irreversible: input.irreversible,
    sensitive_external_write: input.sensitive_external_write,
  });

  let autonomy_class = autonomy.autonomy_class;
  let approval_required = autonomy.approval_required;
  let dispatch_action = autonomy.dispatch_action;
  let block_codes = autonomy.block_codes;
  let approval_reason = autonomy.approval_reason;

  // Domain caps always force human even if seed listed specialists empty
  if (hasDomain && dispatch_action === "dispatch_now") {
    autonomy_class = "require_human";
    approval_required = true;
    dispatch_action = "await_human";
    block_codes = Array.from(new Set([...block_codes, "DOMAIN_CAPABILITY_UNVALIDATED" as const]));
    approval_reason = "Domain/unvalidated capability requires Human Approval";
  }

  return {
    decision_id: `rd-${input.workstream_id}-${Date.now()}`,
    workstream_id: input.workstream_id,
    mission_id: input.mission_id,
    required_capabilities: input.required_capabilities,
    eligible_operators,
    primary_operator: dispatch_action === "block" ? "unassigned" : primary,
    supporting_operator: supporting,
    tools_required: input.tools_required ?? [],
    risk_level: input.risk_level,
    autonomy_class,
    approval_required,
    approval_reason,
    dispatch_action,
    block_codes,
    expected_artifact: input.expected_artifact,
    acceptance_criteria: input.acceptance_criteria,
    reversible: input.reversible,
    within_delegated_authority: input.within_delegated_authority,
    correlation_id: input.correlation_id,
    decided_at: input.decided_at ?? new Date().toISOString(),
    policy_version: "ADR-006.D-006.4" as const,
    unknown_capabilities: unknown,
  };
}
