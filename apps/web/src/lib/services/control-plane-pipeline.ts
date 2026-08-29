import { analyzeMissionHeuristic } from "@/lib/services/analyze";
import { buildMissionContextPack, buildMissionStrategy } from "@/lib/services/mission-strategist";
import { decomposeMissionStrategy } from "@/lib/services/decomposer";
import { routeCapabilities } from "@/lib/services/capability-router";
import { getRepository } from "@/lib/repositories";
import {
  initializeMissionControlState,
  runSupervisorAssessment,
} from "@/lib/services/aipos-supervisor";
import { dispatchWorkstreams } from "@/lib/services/workstream-dispatcher";
import { asLinearDispatchAdapter, getLinearDispatchClient } from "@/lib/linear/client";
import { buildWorkerAssignmentPackages } from "@/lib/services/operator-contract";
import {
  integrateMissionResults,
  verifyAndIntegrateHandoff,
} from "@/lib/services/verifier-integrator";
import { evaluateMissionHealth } from "@/lib/services/health-supervisor";
import { createHandoff } from "@/lib/services/handoff";
import { createEvidence } from "@/lib/services/evidence";
import { applyHumanGate } from "@/lib/services/human-gate";
import { getMissionControlState } from "@/lib/services/control-plane-state";
import { nowIso } from "@/lib/ids";
import { getApprovedMissionBlueprint } from "@/lib/services/mission-blueprint";

export type ControlPlanePipelineResult = {
  mission_id: string;
  blueprint: NonNullable<Awaited<ReturnType<typeof getApprovedMissionBlueprint>>>;
  supervisor: Awaited<ReturnType<typeof runSupervisorAssessment>>;
  routing: ReturnType<typeof routeCapabilities>;
  dispatch: Awaited<ReturnType<typeof dispatchWorkstreams>>;
  assignments: Awaited<ReturnType<typeof buildWorkerAssignmentPackages>>;
  verifications: Array<Awaited<ReturnType<typeof verifyAndIntegrateHandoff>>>;
  integration: Awaited<ReturnType<typeof integrateMissionResults>>;
  health: Awaited<ReturnType<typeof evaluateMissionHealth>>;
  human_gate: Awaited<ReturnType<typeof applyHumanGate>>;
  state: Awaited<ReturnType<typeof getMissionControlState>>;
};

/**
 * End-to-end Control Plane v1 pipeline for a confirmed mission.
 * Uses Linear mock by default (LINEAR_ADAPTER=mock). Does not publish/deploy.
 */
export async function runControlPlanePipeline(input: {
  missionId: string;
  actor: string;
  simulateWorkerPass?: boolean;
}): Promise<ControlPlanePipelineResult> {
  const repo = getRepository();
  const mission = await repo.getMissionById(input.missionId);
  if (!mission) throw new Error("MISSION_NOT_FOUND");
  const blueprint = await getApprovedMissionBlueprint(input.missionId);
  if (!blueprint) throw new Error("BLUEPRINT_APPROVAL_REQUIRED");

  await initializeMissionControlState(input.missionId);
  const supervisor = await runSupervisorAssessment(input.missionId);

  const analysis = analyzeMissionHeuristic(
    mission.mission_summary || mission.title || mission.desired_outcome || input.missionId,
  );
  const contextPack = buildMissionContextPack({
    missionId: input.missionId,
    actor: input.actor,
    context: [
      {
        id: `CTX-${input.missionId}`,
        context_class: "LIVE",
        domain: "mission",
        type: "mission_summary",
        statement: mission.mission_summary || mission.title || "",
        source: "app_db",
        provenance: `mission:${input.missionId}`,
        status: "REPORTED",
        version: "1.0",
        effective_at: nowIso(),
        freshness: "fresh",
        review_due: nowIso(),
        confidence: 0.85,
        evidence: [],
        owner: input.actor,
        sensitivity: (mission.sensitivity_flags?.length ?? 0) > 0 ? "restricted" : "internal",
        access: "need_to_know",
        supersedes: [],
        conflicts_with: [],
      },
    ],
  });
  const strategy = buildMissionStrategy({
    missionId: input.missionId,
    analysis,
    contextPack,
  });
  const workstreams = decomposeMissionStrategy(strategy);

  // Capability truth gate: dispatch is forbidden when no routable operator is verified.
  const routing = routeCapabilities({
    task: strategy.objective,
    required_capabilities: workstreams.flatMap((ws) => ws.required_capabilities),
    capabilities: await repo.listCapabilities(),
    risk_level: analysis.operational_risk,
  });
  if (routing.output !== "ROUTED") {
    throw new Error(`CAPABILITY_ROUTE_REQUIRED:${routing.output}`);
  }

  const human_gate = await applyHumanGate({
    missionId: input.missionId,
    action: `dispatch workstreams for ${input.missionId}`,
    risk_level: analysis.operational_risk,
    reversible: true,
    delegated: analysis.operational_risk <= "L2",
  });

  const linear = asLinearDispatchAdapter(getLinearDispatchClient());
  const dispatch = await dispatchWorkstreams({
    missionId: input.missionId,
    workstreams,
    adapter: linear,
    actor: input.actor,
  });

  const assignments = await buildWorkerAssignmentPackages(input.missionId);
  const verifications = [];

  if (input.simulateWorkerPass !== false) {
    for (const assignment of assignments) {
      const handoff = createHandoff({
        mission_id: input.missionId,
        workstream_id: assignment.workstream_id,
        run_id: assignment.run_id,
        status: "PASS",
        summary: `Simulated worker completion for ${assignment.workstream_id}`,
        mission_state: "VERIFYING",
        received_context: assignment.scoped_context,
        completed_work: assignment.expected_output,
        changes_made: ["worker simulated output"],
        verification: ["artifact present", "evidence labeled"],
        decisions: ["used deterministic stub worker"],
        artifacts: [`artifact://${assignment.run_id}`],
        evidence: [
          createEvidence({
            claim: "Worker output produced",
            status: "CONFIRMED",
            source: "control_plane_pipeline",
            timestamp: nowIso(),
            freshness: "fresh",
            confidence: 0.9,
            evidence_ref: `evidence://${assignment.run_id}`,
            verified_by: input.actor,
          }),
        ],
        next_action: "Integrate verified workstream",
        requires_human: false,
        updated_by: `worker:${assignment.authority_level}`,
      });
      verifications.push(
        await verifyAndIntegrateHandoff({
          missionId: input.missionId,
          handoff,
          actor: input.actor,
        }),
      );
    }
  }

  const integration = await integrateMissionResults(input.missionId);
  const health = await evaluateMissionHealth(input.missionId);
  const state = await getMissionControlState(input.missionId);

  return {
    mission_id: input.missionId,
    blueprint,
    supervisor,
    routing,
    dispatch,
    assignments,
    verifications,
    integration,
    health,
    human_gate,
    state,
  };
}
