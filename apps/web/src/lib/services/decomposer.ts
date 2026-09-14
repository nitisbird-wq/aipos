import type { MissionStrategy, OutcomeWorkstream } from "@/lib/schemas/contracts";
import { OutcomeWorkstreamSchema } from "@/lib/schemas/contracts";
import type { Playbook } from "@/lib/services/playbook-engine";

type DraftWs = Omit<
  OutcomeWorkstream,
  | "workstream_id"
  | "mission_id"
  | "status"
  | "approval_state"
  | "owner_notes"
  | "proposed_actions"
  | "execution_steps"
  | "proposed_worker"
  | "proposed_tools"
  | "evidence_requirements"
  | "authority_level"
  | "human_gate_required"
  | "recovery_strategy"
> & {
  key: string;
  proposed_actions?: string[];
  execution_steps?: string[];
  proposed_worker?: string;
  proposed_tools?: string[];
  evidence_requirements?: string[];
  authority_level?: OutcomeWorkstream["authority_level"];
  human_gate_required?: boolean;
  recovery_strategy?: string;
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
          title: "Define evaluation criteria and scope constraints",
          objective: `Establish measurable criteria and boundaries for: ${objective}`,
          reason_required:
            "Criteria must be agreed before research begins to prevent scope drift and enable fair comparison",
          inputs: ["mission_strategy", "context_pack", "owner_constraints"],
          expected_output: ["evaluation_criteria", "scope_boundary", "constraint_list"],
          acceptance_criteria: [
            "Evaluation criteria are measurable and owner-ranked",
            "Scope boundaries documented and confirmed",
            "Key constraints (audience, timeline, resources) captured",
          ],
          dependencies: [],
          required_capabilities: ["research", "documentation"],
          risk_level: "L1",
          approval_required: false,
          parallelizable: false,
          execution_order: 1,
          proposed_actions: [
            "Review mission strategy for stated constraints",
            "Draft measurable evaluation rubric",
            "Confirm scope boundary with owner",
          ],
          execution_steps: [
            "Map owner requirements to measurable criteria",
            "Rank criteria by importance",
            "Document scope boundary and exclusions",
          ],
          proposed_worker: "research_agent",
          proposed_tools: ["document_writer", "notion_reader"],
          evidence_requirements: [
            "Owner-confirmed priority ranking",
            "Written scope boundary with explicit exclusions",
          ],
          authority_level: "L1",
          human_gate_required: false,
          recovery_strategy:
            "Return criteria draft to owner for revision if scope is ambiguous before proceeding to WS2",
        },
        {
          key: "WS2",
          title: "Gather research candidates and collect source evidence",
          objective: `Research candidate options and collect reliable sources for: ${objective}`,
          reason_required:
            "Evidence-backed candidates are required; no recommendation without sourced data",
          inputs: ["evaluation_criteria", "scope_boundary", "context_pack"],
          expected_output: ["candidate_list", "source_map", "raw_evidence"],
          acceptance_criteria: [
            "Each candidate has at least one cited, reachable source",
            "Sources are dated and domain-relevant",
            "Raw evidence is labeled by epistemic status (CONFIRMED/REPORTED/INFERRED)",
          ],
          dependencies: ["WS1"],
          required_capabilities: ["research"],
          risk_level: "L1",
          approval_required: false,
          parallelizable: true,
          execution_order: 2,
          proposed_actions: [
            "Search primary and secondary sources per criteria",
            "Collect and label evidence with confidence levels",
            "Document source provenance and date",
          ],
          execution_steps: [
            "Run structured searches per each evaluation criterion",
            "Collect evidence snippets with source reference",
            "Label each claim: CONFIRMED / REPORTED / INFERRED / HYPOTHESIS",
          ],
          proposed_worker: "research_agent",
          proposed_tools: ["web_search", "document_reader", "evidence_labeler"],
          evidence_requirements: [
            "Each claim has a source URL or reference",
            "Confidence level assigned to each piece of evidence",
          ],
          authority_level: "L1",
          human_gate_required: false,
          recovery_strategy:
            "If a source is unreachable, document the gap and note confidence impact; proceed with remaining sources",
        },
        {
          key: "WS3",
          title: "Verify evidence quality and claims",
          objective: "Validate that collected evidence is accurate, fresh, and source-trustworthy",
          reason_required:
            "Unverified claims lead to flawed recommendations; verification is a separate epistemic step",
          inputs: ["candidate_list", "source_map", "raw_evidence"],
          expected_output: ["verified_evidence", "source_quality_report", "gap_list"],
          acceptance_criteria: [
            "Each claim status is re-evaluated against original source",
            "Outdated or unreliable sources are flagged",
            "Evidence gaps are enumerated and risk-assessed",
          ],
          dependencies: ["WS2"],
          required_capabilities: ["research", "verification"],
          risk_level: "L1",
          approval_required: false,
          parallelizable: false,
          execution_order: 3,
          proposed_actions: [
            "Cross-check claims against original source",
            "Flag stale or low-confidence evidence",
            "Enumerate knowledge gaps",
          ],
          execution_steps: [
            "Re-read each primary source for each key claim",
            "Downgrade confidence on uncorroborated claims",
            "Produce gap list with risk level per gap",
          ],
          proposed_worker: "verification_agent",
          proposed_tools: ["document_reader", "web_search"],
          evidence_requirements: [
            "Each source accessed and read, not assumed from snippet",
            "Confidence downgrades documented with reason",
          ],
          authority_level: "L1",
          human_gate_required: false,
          recovery_strategy:
            "If evidence gaps are BLOCKERS, pause and surface to owner before continuing to WS4",
        },
        {
          key: "WS4",
          title: "Compare and rank candidates against criteria",
          objective: "Apply evaluation criteria to each candidate to produce a ranked comparison",
          reason_required:
            "Structured comparison prevents bias and gives owner a transparent basis for decision",
          inputs: ["verified_evidence", "evaluation_criteria", "candidate_list"],
          expected_output: ["comparison_matrix", "ranked_list"],
          acceptance_criteria: [
            "Every candidate scored against every criterion",
            "Ranking methodology is transparent and reproducible",
            "Tie-breaking logic is documented",
          ],
          dependencies: ["WS3"],
          required_capabilities: ["research", "documentation"],
          risk_level: "L1",
          approval_required: false,
          parallelizable: false,
          execution_order: 4,
          proposed_actions: [
            "Build comparison matrix (candidates × criteria)",
            "Score each cell with evidence reference",
            "Produce ranked list with explanation",
          ],
          execution_steps: [
            "Populate matrix from verified evidence",
            "Apply weight from owner-ranked criteria",
            "Rank candidates by weighted score",
          ],
          proposed_worker: "research_agent",
          proposed_tools: ["document_writer", "spreadsheet_tool"],
          evidence_requirements: [
            "Each cell score cites a specific piece of verified evidence",
            "Weighting method documented",
          ],
          authority_level: "L1",
          human_gate_required: false,
          recovery_strategy:
            "Return to WS3 if comparison reveals critical evidence gaps; do not proceed with sparse matrix",
        },
        {
          key: "WS5",
          title: "Critical review — challenge recommendations, bias, and missing evidence",
          objective: "Adversarially challenge the ranked list for bias, gaps, and unexamined risks",
          reason_required:
            "An independent critical pass prevents confirmation bias before the final recommendation is committed",
          inputs: ["comparison_matrix", "ranked_list", "verified_evidence"],
          expected_output: ["critique_report", "bias_flags", "risk_register"],
          acceptance_criteria: [
            "At least one counter-argument surfaced per top-ranked candidate",
            "Known biases in evidence collection are enumerated",
            "Unexamined risks are documented with severity",
          ],
          dependencies: ["WS4"],
          required_capabilities: ["research", "verification"],
          risk_level: "L2",
          approval_required: false,
          parallelizable: false,
          execution_order: 5,
          proposed_actions: [
            "Steelman the case against the top-ranked option",
            "Identify sources that could challenge the ranking",
            "Document remaining uncertainties",
          ],
          execution_steps: [
            "For each top candidate, find strongest counter-evidence",
            "Flag any ranking cell that relied on a single source",
            "Produce risk register with likelihood and impact",
          ],
          proposed_worker: "critic_agent",
          proposed_tools: ["web_search", "document_reader", "document_writer"],
          evidence_requirements: [
            "Counter-evidence cited for each major finding",
            "Risk severity rated on consistent scale",
          ],
          authority_level: "L1",
          human_gate_required: false,
          recovery_strategy:
            "If critique reveals ranking is unreliable, return to WS3 for additional evidence before WS6",
        },
        {
          key: "WS6",
          title: "Produce recommendation with reasons, pros/cons and implementation plan",
          objective: `Deliver ${deliverableType}: ranked recommendation with rationale, trade-offs, and actionable plan for: ${objective}`,
          reason_required:
            "Owner needs a decision-ready deliverable with explicit reasons, risks, and a concrete implementation path",
          inputs: ["comparison_matrix", "ranked_list", "critique_report", "deliverable_contract"],
          expected_output: ["recommendation_document", "implementation_plan", "evidence_bundle"],
          acceptance_criteria: criteria,
          dependencies: ["WS5"],
          required_capabilities: ["research", "documentation", "verification"],
          risk_level: "L2",
          approval_required: true,
          parallelizable: false,
          execution_order: 6,
          proposed_actions: [
            "Write recommendation with explicit rationale from evidence",
            "List pros and cons for each option discussed",
            "Provide step-by-step implementation plan",
          ],
          execution_steps: [
            "Draft recommendation section with top choice and runner-up",
            "List pros/cons per option from comparison matrix",
            "Write implementation plan with timeline and milestones",
            "Attach evidence bundle with all source references",
          ],
          proposed_worker: "writer_agent",
          proposed_tools: ["document_writer", "notion_writer"],
          evidence_requirements: [
            "Every recommendation claim cites a verified evidence item",
            "Implementation plan steps are grounded in constraint list from WS1",
          ],
          authority_level: "L2",
          human_gate_required: true,
          recovery_strategy:
            "If owner rejects recommendation, return to WS4 with updated criteria and regenerate",
        },
        {
          key: "WS7",
          title: "Independent verification of final deliverable",
          objective: "Verify that the deliverable satisfies all acceptance criteria independently",
          reason_required:
            "Author cannot verify their own output; independent verification is required before delivery",
          inputs: ["recommendation_document", "implementation_plan", "evaluation_criteria"],
          expected_output: ["verification_report", "delivery_approval"],
          acceptance_criteria: [
            "Every acceptance criterion in the deliverable contract is assessed",
            "All open risks are documented",
            "Deliverable is ready for owner handoff",
          ],
          dependencies: ["WS6"],
          required_capabilities: ["verification", "documentation"],
          risk_level: "L1",
          approval_required: false,
          parallelizable: false,
          execution_order: 7,
          proposed_actions: [
            "Read deliverable against each acceptance criterion",
            "Verify evidence bundle completeness",
            "Confirm implementation plan is actionable",
          ],
          execution_steps: [
            "Check each acceptance criterion: pass / fail / partial",
            "Flag any unresolved risks from WS5 risk register",
            "Issue delivery approval if all criteria pass",
          ],
          proposed_worker: "verification_agent",
          proposed_tools: ["document_reader"],
          evidence_requirements: [
            "Criterion-by-criterion verification log",
            "Sign-off record with verifier identity",
          ],
          authority_level: "L1",
          human_gate_required: false,
          recovery_strategy:
            "If any acceptance criterion fails, return to WS6 with specific gap for revision",
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
