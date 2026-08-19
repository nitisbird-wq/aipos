import type { MissionStrategy, OutcomeWorkstream } from "@/lib/schemas/contracts";
import { OutcomeWorkstreamSchema } from "@/lib/schemas/contracts";

function capabilityFromDeliverable(deliverableType: string): string[] {
  if (deliverableType === "software_change") return ["code", "testing", "verification"];
  return ["research", "documentation", "verification"];
}

export function decomposeMissionStrategy(strategy: MissionStrategy): OutcomeWorkstream[] {
  const capabilities = capabilityFromDeliverable(strategy.final_deliverable.deliverable_type);
  const workstreams: OutcomeWorkstream[] = [
    {
      workstream_id: `${strategy.mission_id}-WS1`,
      mission_id: strategy.mission_id,
      title: "Build context-backed approach",
      objective: "Translate strategy intent into executable outcome plan",
      reason_required: "Ensures deliverable is grounded in accepted context and constraints",
      inputs: ["mission_strategy", "context_pack"],
      expected_output: ["validated_execution_plan"],
      acceptance_criteria: ["Dependencies enumerated", "Risks categorized", "Owner interruptions minimized"],
      dependencies: [],
      required_capabilities: [capabilities[0]],
      risk_level: "L1",
      approval_required: false,
      parallelizable: false,
      execution_order: 1,
      status: "ready",
    },
    {
      workstream_id: `${strategy.mission_id}-WS2`,
      mission_id: strategy.mission_id,
      title: "Produce final deliverable",
      objective: "Create required output and artifacts from deliverable contract",
      reason_required: "Primary mission outcome is measured at this stage",
      inputs: ["validated_execution_plan", "deliverable_contract"],
      expected_output: ["final_deliverable", "evidence_bundle"],
      acceptance_criteria: strategy.final_deliverable.acceptance_criteria,
      dependencies: [`${strategy.mission_id}-WS1`],
      required_capabilities: capabilities,
      risk_level: "L2",
      approval_required: strategy.missing_information.some((item) => item.kind === "BLOCKER"),
      parallelizable: false,
      execution_order: 2,
      status: "pending",
    },
  ];

  return workstreams.map((row) => OutcomeWorkstreamSchema.parse(row));
}
