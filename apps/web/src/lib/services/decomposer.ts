import type { MissionStrategy, OutcomeWorkstream } from "@/lib/schemas/contracts";
import { OutcomeWorkstreamSchema } from "@/lib/schemas/contracts";
import type { Playbook } from "@/lib/services/playbook-engine";

type DraftWs = Omit<OutcomeWorkstream, "workstream_id" | "mission_id" | "status"> & {
  key: string;
};

const GENERIC_TITLES = new Set([
  "understand scope",
  "do main work",
  "create output",
  "build context-backed approach",
  "produce final deliverable",
  "understand & scope",
  "produce primary deliverable",
]);

function playbookTemplates(playbook: string, strategy: MissionStrategy): DraftWs[] {
  const criteria = strategy.final_deliverable.acceptance_criteria;
  const objective = strategy.objective;
  const deliverableType = strategy.final_deliverable.deliverable_type;

  switch (playbook as Playbook["id"]) {
    case "research":
      return [
        {
          key: "WS1",
          title: "Frame research questions and source plan",
          objective: `Define hypotheses and source set for: ${objective}`,
          reason_required: "Without framed questions, findings cannot be validated",
          inputs: ["mission_strategy", "context_pack"],
          expected_output: ["research_questions", "source_plan"],
          acceptance_criteria: [
            "Hypotheses listed",
            "Sources prioritized",
            "Confidence targets set",
          ],
          dependencies: [],
          required_capabilities: ["research"],
          risk_level: "L1",
          approval_required: false,
          parallelizable: false,
          execution_order: 1,
        },
        {
          key: "WS2",
          title: "Gather and score evidence from sources",
          objective: "Collect evidence with epistemic labels; no silent promotion",
          reason_required: "Evidence discipline is required before synthesis",
          inputs: ["research_questions", "source_plan"],
          expected_output: ["evidence_table", "source_notes"],
          acceptance_criteria: ["Each claim labeled", "Evidence refs present"],
          dependencies: ["WS1"],
          required_capabilities: ["research", "documentation"],
          risk_level: "L1",
          approval_required: false,
          parallelizable: true,
          execution_order: 2,
        },
        {
          key: "WS3",
          title: "Synthesize findings into research deliverable",
          objective: `Produce ${deliverableType} meeting acceptance criteria`,
          reason_required: "Final deliverable must answer owner objective with evidence",
          inputs: ["evidence_table", "deliverable_contract"],
          expected_output: ["final_deliverable", "evidence_bundle"],
          acceptance_criteria: criteria,
          dependencies: ["WS2"],
          required_capabilities: ["research", "documentation", "verification"],
          risk_level: "L2",
          approval_required: false,
          parallelizable: false,
          execution_order: 3,
        },
      ];
    case "debug":
      return [
        {
          key: "WS1",
          title: "Reproduce failure with runtime evidence",
          objective: `Reproduce and capture logs for: ${objective}`,
          reason_required: "Fixes without reproduction are high-risk guesses",
          inputs: ["mission_strategy", "incident_signals"],
          expected_output: ["repro_steps", "runtime_evidence"],
          acceptance_criteria: ["Issue reproduced", "Evidence captured"],
          dependencies: [],
          required_capabilities: ["code", "testing"],
          risk_level: "L2",
          approval_required: false,
          parallelizable: false,
          execution_order: 1,
        },
        {
          key: "WS2",
          title: "Implement root-cause fix and regression coverage",
          objective: "Apply minimal fix and add regression tests",
          reason_required: "Outcome must prevent recurrence with verified tests",
          inputs: ["repro_steps", "runtime_evidence"],
          expected_output: ["code_fix", "regression_tests"],
          acceptance_criteria: criteria,
          dependencies: ["WS1"],
          required_capabilities: ["code", "testing", "verification"],
          risk_level: "L2",
          approval_required: false,
          parallelizable: false,
          execution_order: 2,
        },
      ];
    case "software_build":
      return [
        {
          key: "WS1",
          title: "Specify behavior and acceptance tests",
          objective: `Define implementable behavior for: ${objective}`,
          reason_required: "Backward planning from deliverable contract",
          inputs: ["mission_strategy", "deliverable_contract"],
          expected_output: ["behavior_spec", "acceptance_tests"],
          acceptance_criteria: ["Behavior unambiguous", "Tests named"],
          dependencies: [],
          required_capabilities: ["docs", "code"],
          risk_level: "L1",
          approval_required: false,
          parallelizable: false,
          execution_order: 1,
        },
        {
          key: "WS2",
          title: "Implement feature increment",
          objective: "Ship code change matching behavior spec",
          reason_required: "Primary software outcome",
          inputs: ["behavior_spec"],
          expected_output: ["code_change"],
          acceptance_criteria: ["Compiles", "Matches behavior"],
          dependencies: ["WS1"],
          required_capabilities: ["code"],
          risk_level: "L2",
          approval_required: false,
          parallelizable: false,
          execution_order: 2,
        },
        {
          key: "WS3",
          title: "Verify with tests and document impact",
          objective: "Confirm acceptance criteria and document rollout impact",
          reason_required: "Verification before integration",
          inputs: ["code_change", "acceptance_tests"],
          expected_output: ["test_report", "impact_notes"],
          acceptance_criteria: criteria,
          dependencies: ["WS2"],
          required_capabilities: ["testing", "verification", "docs"],
          risk_level: "L1",
          approval_required: false,
          parallelizable: false,
          execution_order: 3,
        },
      ];
    case "automation":
      return [
        {
          key: "WS1",
          title: "Define trigger, inputs, and failure modes",
          objective: `Model automation contract for: ${objective}`,
          reason_required: "Automation without failure modes is unsafe",
          inputs: ["mission_strategy"],
          expected_output: ["workflow_contract"],
          acceptance_criteria: ["Trigger defined", "Failure modes listed"],
          dependencies: [],
          required_capabilities: ["automation"],
          risk_level: "L1",
          approval_required: false,
          parallelizable: false,
          execution_order: 1,
        },
        {
          key: "WS2",
          title: "Build and validate workflow handlers",
          objective: "Implement workflow and validate handlers with recovery path",
          reason_required: "Execution truth requires validated handlers",
          inputs: ["workflow_contract"],
          expected_output: ["workflow_definition", "validation_report"],
          acceptance_criteria: criteria,
          dependencies: ["WS1"],
          required_capabilities: ["automation", "verification"],
          risk_level: "L2",
          approval_required: true,
          parallelizable: false,
          execution_order: 2,
        },
      ];
    case "decision":
      return [
        {
          key: "WS1",
          title: "Define decision criteria and options",
          objective: `Frame decision options for: ${objective}`,
          reason_required: "Decision quality depends on explicit criteria",
          inputs: ["mission_strategy", "context_pack"],
          expected_output: ["decision_matrix"],
          acceptance_criteria: ["Options listed", "Criteria weighted"],
          dependencies: [],
          required_capabilities: ["strategy_analysis"],
          risk_level: "L1",
          approval_required: false,
          parallelizable: false,
          execution_order: 1,
        },
        {
          key: "WS2",
          title: "Recommend choice with risk and evidence",
          objective: "Produce decision brief with recommendation and risks",
          reason_required: "Owner needs actionable recommendation",
          inputs: ["decision_matrix", "deliverable_contract"],
          expected_output: ["decision_brief"],
          acceptance_criteria: criteria,
          dependencies: ["WS1"],
          required_capabilities: ["strategy_analysis", "documentation"],
          risk_level: "L2",
          approval_required: true,
          parallelizable: false,
          execution_order: 2,
        },
      ];
    case "knowledge_organization":
      return [
        {
          key: "WS1",
          title: "Normalize taxonomy and inventory sources",
          objective: `Inventory and classify knowledge for: ${objective}`,
          reason_required: "Organization requires shared taxonomy first",
          inputs: ["context_pack"],
          expected_output: ["taxonomy", "inventory"],
          acceptance_criteria: ["Taxonomy approved for use", "Sources inventoried"],
          dependencies: [],
          required_capabilities: ["knowledge_management"],
          risk_level: "L1",
          approval_required: false,
          parallelizable: false,
          execution_order: 1,
        },
        {
          key: "WS2",
          title: "Restructure pages and link evidence",
          objective: "Apply taxonomy and produce navigable knowledge structure",
          reason_required: "Deliverable is organized knowledge, not chat notes",
          inputs: ["taxonomy", "inventory"],
          expected_output: ["restructured_pages", "link_map"],
          acceptance_criteria: criteria,
          dependencies: ["WS1"],
          required_capabilities: ["knowledge_management", "documentation"],
          risk_level: "L1",
          approval_required: false,
          parallelizable: false,
          execution_order: 2,
        },
      ];
    case "business_launch":
      return [
        {
          key: "WS1",
          title: "Define market objective and success metrics",
          objective: `Set launch metrics for: ${objective}`,
          reason_required: "Launch without metrics cannot be verified",
          inputs: ["mission_strategy"],
          expected_output: ["launch_objectives", "success_metrics"],
          acceptance_criteria: ["Metrics measurable", "Audience defined"],
          dependencies: [],
          required_capabilities: ["domain.business", "strategy_analysis"],
          risk_level: "L1",
          approval_required: false,
          parallelizable: false,
          execution_order: 1,
        },
        {
          key: "WS2",
          title: "Build launch plan and go/no-go gate",
          objective: "Produce launch plan with explicit go/no-go criteria",
          reason_required: "Owner needs decision-ready launch package",
          inputs: ["launch_objectives", "success_metrics"],
          expected_output: ["launch_plan", "go_no_go_checklist"],
          acceptance_criteria: criteria,
          dependencies: ["WS1"],
          required_capabilities: ["domain.business", "documentation"],
          risk_level: "L2",
          approval_required: true,
          parallelizable: false,
          execution_order: 2,
        },
      ];
    case "creative_synthesis":
      return [
        {
          key: "WS1",
          title: "Gather constraints and concept directions",
          objective: `Explore concepts under constraints for: ${objective}`,
          reason_required: "Creative work must stay within owner constraints",
          inputs: ["mission_strategy", "context_pack"],
          expected_output: ["concept_directions"],
          acceptance_criteria: ["Constraints captured", "Directions ranked"],
          dependencies: [],
          required_capabilities: ["design", "docs"],
          risk_level: "L1",
          approval_required: false,
          parallelizable: false,
          execution_order: 1,
        },
        {
          key: "WS2",
          title: "Produce final creative package",
          objective: "Deliver selected concept in required format",
          reason_required: "Final package is the measurable deliverable",
          inputs: ["concept_directions", "deliverable_contract"],
          expected_output: ["creative_package"],
          acceptance_criteria: criteria,
          dependencies: ["WS1"],
          required_capabilities: ["design", "verification"],
          risk_level: "L1",
          approval_required: false,
          parallelizable: false,
          execution_order: 2,
        },
      ];
    case "investigation":
    default:
      return [
        {
          key: "WS1",
          title: "Collect signals and test assumptions",
          objective: `Investigate signals for: ${objective}`,
          reason_required: "Investigation starts from observable signals, not guesses",
          inputs: ["mission_strategy", "context_pack"],
          expected_output: ["signal_log", "assumption_tests"],
          acceptance_criteria: ["Signals timestamped", "Assumptions labeled"],
          dependencies: [],
          required_capabilities: ["research", "documentation"],
          risk_level: "L1",
          approval_required: false,
          parallelizable: false,
          execution_order: 1,
        },
        {
          key: "WS2",
          title: "Document findings and escalate unresolved risks",
          objective: "Produce investigation report with evidence and open risks",
          reason_required: "Owner needs actionable findings, not narrative",
          inputs: ["signal_log", "assumption_tests", "deliverable_contract"],
          expected_output: ["investigation_report", "risk_register"],
          acceptance_criteria: criteria,
          dependencies: ["WS1"],
          required_capabilities: ["research", "documentation", "verification"],
          risk_level: "L2",
          approval_required: strategy.missing_information.some((i) => i.kind === "BLOCKER"),
          parallelizable: false,
          execution_order: 2,
        },
      ];
  }
}

export function isGenericWorkstreamTitle(title: string): boolean {
  return GENERIC_TITLES.has(title.trim().toLowerCase());
}

/**
 * Outcome-driven decomposer: Mission Strategy + Deliverable Contract → workstreams.
 * Capabilities are derived after work is defined. Variable depth by playbook.
 */
export function decomposeMissionStrategy(strategy: MissionStrategy): OutcomeWorkstream[] {
  const drafts = playbookTemplates(strategy.selected_playbook, strategy);
  const idByKey = new Map(drafts.map((d) => [d.key, `${strategy.mission_id}-${d.key}`]));

  const workstreams: OutcomeWorkstream[] = drafts.map((draft) => {
    if (isGenericWorkstreamTitle(draft.title)) {
      throw new Error(`GENERIC_WORKSTREAM_REJECTED:${draft.title}`);
    }
    const { key, ...rest } = draft;
    return OutcomeWorkstreamSchema.parse({
      ...rest,
      workstream_id: idByKey.get(key)!,
      mission_id: strategy.mission_id,
      dependencies: draft.dependencies.map((dep) => idByKey.get(dep) ?? dep),
      approval_required:
        draft.approval_required ||
        strategy.missing_information.some((item) => item.kind === "BLOCKER"),
      status: draft.execution_order === 1 ? "ready" : "pending",
    });
  });

  return workstreams;
}
