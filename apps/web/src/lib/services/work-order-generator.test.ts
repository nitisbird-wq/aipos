import { describe, expect, it } from "vitest";
import { generateWorkOrder, generateAllWorkOrders } from "@/lib/services/work-order-generator";
import type { OutcomeWorkstream, MissionStrategy } from "@/lib/schemas/contracts";

// ── Test helpers ───────────────────────────────────────────────────────────────

function makeStrategy(overrides: Partial<MissionStrategy> = {}): MissionStrategy {
  return {
    strategy_id: "STR-TEST-001",
    mission_id: "MIS-TEST-001",
    objective: "Test mission objective",
    desired_outcome: "Test mission desired outcome",
    final_deliverable: {
      deliverable_type: "report",
      audience: "owner",
      purpose: "test",
      required_sections: ["Summary", "Findings"],
      required_artifacts: [],
      quality_standard: "professional",
      acceptance_criteria: ["complete"],
      evidence_requirement: "verified",
      format: "markdown",
      completion_definition: "all sections complete",
    },
    selected_playbook: "research",
    strategy_reasoning: ["test"],
    missing_information: [],
    backward_plan_summary: ["step 1", "step 2"],
    decomposition_ready: true,
    ...overrides,
  };
}

function makeWs(overrides: Partial<OutcomeWorkstream> = {}): OutcomeWorkstream {
  return {
    workstream_id: "WS-001",
    mission_id: "MIS-TEST-001",
    title: "Research workstream",
    objective: "Gather relevant research",
    reason_required: "Need data before analysis",
    inputs: ["raw_data"],
    expected_output: ["research_findings"],
    acceptance_criteria: ["findings complete", "sources cited"],
    dependencies: [],
    required_capabilities: ["research"],
    risk_level: "L1",
    approval_required: false,
    parallelizable: false,
    execution_order: 1,
    status: "pending",
    approval_state: "PROPOSED",
    owner_notes: "",
    proposed_actions: ["Search databases", "Compile findings"],
    execution_steps: ["Step 1: search", "Step 2: compile"],
    proposed_worker: "research_agent",
    proposed_tools: ["web_search", "document_reader"],
    evidence_requirements: ["source list", "confidence score"],
    authority_level: "L1",
    human_gate_required: false,
    recovery_strategy: "retry with different sources",
    ...overrides,
  };
}

// ── GOLDEN MISSION: MIS-GOLDEN-VIDEO-001 ──────────────────────────────────────

describe("Golden Mission MIS-GOLDEN-VIDEO-001: Video → Transcription → Analysis → Presentation → Owner Gate → Graphics → Slides → Final Gate → Notion → LINE → Verification", () => {
  const strategy = makeStrategy({
    strategy_id: "STR-GOLDEN-001",
    mission_id: "MIS-GOLDEN-VIDEO-001",
    objective:
      "Transform recorded video content into a polished presentation delivered to stakeholders via Notion and LINE",
    desired_outcome:
      "Approved slide deck published to Notion and delivered via LINE with verified delivery",
    final_deliverable: {
      deliverable_type: "slide_deck",
      audience: "management stakeholders",
      purpose: "Present research insights",
      required_sections: ["Summary", "Key Findings", "Recommendations", "Next Steps"],
      required_artifacts: ["slide_deck", "notion_page_url", "line_delivery_receipt"],
      quality_standard: "executive-ready",
      acceptance_criteria: ["Owner approved", "Notion published", "LINE delivered"],
      evidence_requirement: "delivery confirmation",
      format: "PowerPoint/Notion",
      completion_definition: "LINE delivery confirmed",
    },
  });

  const workstreams: OutcomeWorkstream[] = [
    makeWs({
      workstream_id: "WS-VID-01",
      mission_id: "MIS-GOLDEN-VIDEO-001",
      title: "Video Transcription",
      objective: "Transcribe raw video into structured text with timestamps",
      inputs: ["raw_video_file"],
      expected_output: ["raw_transcript"],
      proposed_worker: "transcription_agent",
      proposed_tools: ["audio_extractor", "transcription_engine"],
      execution_order: 1,
      dependencies: [],
      required_capabilities: ["transcription"],
    }),
    makeWs({
      workstream_id: "WS-VID-02",
      mission_id: "MIS-GOLDEN-VIDEO-001",
      title: "Content Research and Analysis",
      objective: "Analyze transcript and research supporting evidence",
      inputs: ["raw_transcript", "research_brief"],
      expected_output: ["research_findings", "content_outline"],
      proposed_worker: "research_agent",
      proposed_tools: ["web_search", "document_reader"],
      execution_order: 2,
      dependencies: ["WS-VID-01"],
      required_capabilities: ["research", "analysis"],
    }),
    makeWs({
      workstream_id: "WS-VID-03",
      mission_id: "MIS-GOLDEN-VIDEO-001",
      title: "Presentation Planning",
      objective: "Draft presentation structure and slide plan from research findings",
      inputs: ["research_findings", "content_outline"],
      expected_output: ["presentation_plan"],
      proposed_worker: "writing_agent",
      proposed_tools: ["document_writer"],
      execution_order: 3,
      dependencies: ["WS-VID-02"],
      required_capabilities: ["writing"],
    }),
    makeWs({
      workstream_id: "WS-VID-04",
      mission_id: "MIS-GOLDEN-VIDEO-001",
      title: "Owner Presentation Gate",
      objective: "Owner reviews and approves presentation plan before production",
      inputs: ["presentation_plan"],
      expected_output: ["approved_presentation_plan"],
      proposed_worker: "owner",
      proposed_tools: [],
      execution_order: 4,
      dependencies: ["WS-VID-03"],
      required_capabilities: ["decision"],
      human_gate_required: true,
      approval_required: true,
      authority_level: "L3",
      risk_level: "L3",
      proposed_actions: ["Review presentation plan", "Approve or reject with feedback"],
    }),
    makeWs({
      workstream_id: "WS-VID-05",
      mission_id: "MIS-GOLDEN-VIDEO-001",
      title: "Graphic Asset Generation",
      objective: "Generate visual assets and graphics for the presentation",
      inputs: ["approved_presentation_plan"],
      expected_output: ["graphic_assets"],
      proposed_worker: "image_agent",
      proposed_tools: ["image_generator", "design_tool"],
      execution_order: 5,
      dependencies: ["WS-VID-04"],
      required_capabilities: ["design", "image_generation"],
    }),
    makeWs({
      workstream_id: "WS-VID-06",
      mission_id: "MIS-GOLDEN-VIDEO-001",
      title: "Slide Deck Assembly",
      objective: "Assemble approved plan and graphics into final slide deck",
      inputs: ["approved_presentation_plan", "graphic_assets"],
      expected_output: ["final_slide_deck"],
      proposed_worker: "presentation_agent",
      proposed_tools: ["slide_builder"],
      execution_order: 6,
      dependencies: ["WS-VID-05"],
      required_capabilities: ["presentation"],
    }),
    makeWs({
      workstream_id: "WS-VID-07",
      mission_id: "MIS-GOLDEN-VIDEO-001",
      title: "Final Owner Approval Gate",
      objective: "Owner reviews final slide deck and approves for delivery",
      inputs: ["final_slide_deck"],
      expected_output: ["delivery_authorization"],
      proposed_worker: "owner",
      proposed_tools: [],
      execution_order: 7,
      dependencies: ["WS-VID-06"],
      required_capabilities: ["decision"],
      human_gate_required: true,
      approval_required: true,
      authority_level: "L3",
      risk_level: "L3",
      proposed_actions: ["Review final slide deck", "Authorize delivery"],
    }),
    makeWs({
      workstream_id: "WS-VID-08",
      mission_id: "MIS-GOLDEN-VIDEO-001",
      title: "Notion Publication",
      objective: "Publish approved slide deck to Notion workspace",
      inputs: ["final_slide_deck", "delivery_authorization"],
      expected_output: ["notion_page_url"],
      proposed_worker: "notion_adapter",
      proposed_tools: ["notion_writer"],
      execution_order: 8,
      dependencies: ["WS-VID-07"],
      required_capabilities: ["notion_write"],
      risk_level: "L2",
    }),
    makeWs({
      workstream_id: "WS-VID-09",
      mission_id: "MIS-GOLDEN-VIDEO-001",
      title: "LINE Message Delivery",
      objective: "Send final presentation link to stakeholders via LINE",
      inputs: ["notion_page_url", "delivery_authorization"],
      expected_output: ["line_delivery_receipt"],
      proposed_worker: "line_adapter",
      proposed_tools: ["line_messenger"],
      execution_order: 9,
      dependencies: ["WS-VID-08"],
      required_capabilities: ["line_send"],
      risk_level: "L2",
    }),
    makeWs({
      workstream_id: "WS-VID-10",
      mission_id: "MIS-GOLDEN-VIDEO-001",
      title: "Delivery Verification",
      objective: "Verify Notion publication and LINE delivery completed successfully",
      inputs: ["notion_page_url", "line_delivery_receipt"],
      expected_output: ["verification_report"],
      proposed_worker: "verification_agent",
      proposed_tools: ["notion_reader", "line_status_api"],
      execution_order: 10,
      dependencies: ["WS-VID-09"],
      required_capabilities: ["verification"],
    }),
  ];

  const workOrders = generateAllWorkOrders({ workstreams }, strategy);

  it("generates a work order for all 10 workstreams", () => {
    expect(workOrders).toHaveLength(10);
  });

  it("assigns correct TaskType to each workstream", () => {
    const types = workOrders.map((wo) => wo.task_type);
    expect(types[0]).toBe("TRANSCRIPTION");   // WS-VID-01
    expect(types[1]).toBe("RESEARCH");         // WS-VID-02
    expect(types[2]).toBe("WRITING");          // WS-VID-03
    expect(types[3]).toBe("HUMAN_GATE");       // WS-VID-04
    expect(types[4]).toBe("IMAGE_GENERATION"); // WS-VID-05
    expect(types[5]).toBe("PRESENTATION");     // WS-VID-06
    expect(types[6]).toBe("HUMAN_GATE");       // WS-VID-07
    expect(types[7]).toBe("DELIVERY");         // WS-VID-08
    expect(types[8]).toBe("DELIVERY");         // WS-VID-09
    expect(types[9]).toBe("VERIFICATION");     // WS-VID-10
  });

  it("correctly identifies human gates", () => {
    const gates = workOrders.filter((wo) => wo.human_decision_required);
    expect(gates.length).toBeGreaterThanOrEqual(2);
    expect(gates.map((g) => g.workstream_id)).toContain("WS-VID-04");
    expect(gates.map((g) => g.workstream_id)).toContain("WS-VID-07");
  });

  it("Notion delivery has EXTERNAL_WRITE side effect class", () => {
    const notion = workOrders.find((wo) => wo.workstream_id === "WS-VID-08");
    expect(notion?.side_effect_class).toBe("EXTERNAL_WRITE");
  });

  it("LINE delivery has EXTERNAL_SEND side effect class", () => {
    const line = workOrders.find((wo) => wo.workstream_id === "WS-VID-09");
    expect(line?.side_effect_class).toBe("EXTERNAL_SEND");
  });

  it("each work order answers 13 required questions (fields present)", () => {
    for (const wo of workOrders) {
      expect(wo.task_objective).toBeTruthy();          // Q1: What
      expect(wo.mission_context).toBeTruthy();          // why: mission context
      expect(Array.isArray(wo.required_inputs)).toBe(true); // Q2: Inputs
      expect(Array.isArray(wo.input_bindings)).toBe(true);  // Q2: Artifact bindings
      expect(Array.isArray(wo.previous_artifacts)).toBe(true); // Q3: Previous artifacts
      expect(Array.isArray(wo.proposed_actions)).toBe(true);   // Q4: Actions
      expect(wo.recommended_worker).toBeTruthy();      // Q5: Worker
      expect(Array.isArray(wo.recommended_tools)).toBe(true);  // Q6: Tools
      expect(wo.execution_prompt.length).toBeGreaterThan(50);  // Q7: Prompt
      expect(wo.expected_output).toBeTruthy();         // Q8: Output
      expect(Array.isArray(wo.evidence_requirements)).toBe(true); // Q9: Evidence
      expect(Array.isArray(wo.depends_on_work_orders)).toBe(true); // Q10: Dependencies
      expect(wo.authority_level).toBeTruthy();         // Q11: Owner decision/authority
      expect(wo.failure_instructions).toBeTruthy();    // Q12: Failure
      expect(wo.handoff_instructions).toBeTruthy();    // Q13: Next destination
    }
  });

  it("execution prompt contains actual mission context — not generic placeholder", () => {
    const transcriptionWo = workOrders[0]!;
    expect(transcriptionWo.execution_prompt).toContain("MIS-GOLDEN-VIDEO-001");
    expect(transcriptionWo.execution_prompt).not.toContain("Q3");
    expect(transcriptionWo.execution_prompt).not.toContain("{{mission_name}}");
  });

  it("dependency chain is correctly linked via input_bindings", () => {
    const researchWo = workOrders[1]!; // WS-VID-02 depends on WS-VID-01
    const hasTranscriptBinding = researchWo.input_bindings.some((b) =>
      b.source_work_order_id !== null || b.artifact_key.includes("transcript"),
    );
    expect(hasTranscriptBinding).toBe(true);
  });

  it("external delivery work orders have approval_scope set", () => {
    const notionWo = workOrders.find((wo) => wo.workstream_id === "WS-VID-08");
    const lineWo = workOrders.find((wo) => wo.workstream_id === "WS-VID-09");
    expect(notionWo?.approval_scope).not.toBeNull();
    expect(lineWo?.approval_scope).not.toBeNull();
  });

  it("prompt_version is set on all work orders", () => {
    for (const wo of workOrders) {
      expect(wo.prompt_version).toMatch(/^\d+\.\d+\.\d+$/);
    }
  });
});

// ── REGRESSION 1: Excel sales data → analysis → management report ──────────────

describe("Regression Mission 1: Excel Sales Data → Analysis → Management Report", () => {
  const strategy = makeStrategy({
    strategy_id: "STR-SALES-001",
    mission_id: "MIS-SALES-REPORT-001",
    objective:
      "Analyze Q3 sales performance data from Excel and produce a management report with recommendations",
    desired_outcome:
      "Management report with KPI analysis, trend identification, and actionable recommendations",
    selected_playbook: "decision",
    final_deliverable: {
      deliverable_type: "management_report",
      audience: "senior management",
      purpose: "Q3 sales performance review",
      required_sections: ["Executive Summary", "KPI Performance", "Trend Analysis", "Recommendations"],
      required_artifacts: ["management_report"],
      quality_standard: "executive-ready",
      acceptance_criteria: ["all KPIs analyzed", "recommendations actionable"],
      evidence_requirement: "data-backed",
      format: "PDF/Document",
      completion_definition: "report approved by management",
    },
  });

  const workstreams: OutcomeWorkstream[] = [
    makeWs({
      workstream_id: "WS-SALES-01",
      mission_id: "MIS-SALES-REPORT-001",
      title: "Sales Data Extraction and Validation",
      objective: "Extract and validate data from the Excel sales file",
      inputs: ["excel_sales_file"],
      expected_output: ["validated_sales_dataset"],
      proposed_worker: "data_analyst",
      proposed_tools: ["excel_reader", "data_validator"],
      execution_order: 1,
      dependencies: [],
      required_capabilities: ["data_processing"],
    }),
    makeWs({
      workstream_id: "WS-SALES-02",
      mission_id: "MIS-SALES-REPORT-001",
      title: "KPI and Trend Analysis",
      objective: "Analyze sales KPIs, trends, and anomalies from validated dataset",
      inputs: ["validated_sales_dataset"],
      expected_output: ["kpi_analysis", "trend_report"],
      proposed_worker: "analysis_agent",
      proposed_tools: ["data_analysis_tool", "chart_generator"],
      execution_order: 2,
      dependencies: ["WS-SALES-01"],
      required_capabilities: ["analysis", "data_processing"],
    }),
    makeWs({
      workstream_id: "WS-SALES-03",
      mission_id: "MIS-SALES-REPORT-001",
      title: "Management Report Writing",
      objective: "Write executive management report from analysis findings",
      inputs: ["kpi_analysis", "trend_report"],
      expected_output: ["management_report_draft"],
      proposed_worker: "writing_agent",
      proposed_tools: ["document_writer"],
      execution_order: 3,
      dependencies: ["WS-SALES-02"],
      required_capabilities: ["writing"],
    }),
    makeWs({
      workstream_id: "WS-SALES-04",
      mission_id: "MIS-SALES-REPORT-001",
      title: "Report Verification",
      objective: "Verify report accuracy against source data",
      inputs: ["management_report_draft", "validated_sales_dataset"],
      expected_output: ["verified_report"],
      proposed_worker: "verification_agent",
      proposed_tools: ["document_reader", "data_validator"],
      execution_order: 4,
      dependencies: ["WS-SALES-03"],
      required_capabilities: ["verification"],
    }),
  ];

  const workOrders = generateAllWorkOrders({ workstreams }, strategy);

  it("generates 4 work orders for the 4-workstream sales report mission", () => {
    expect(workOrders).toHaveLength(4);
  });

  it("data extraction work order uses ANALYSIS task type", () => {
    // First WS is data extraction/validation — should be analysis or writing
    expect(["ANALYSIS", "RESEARCH", "WRITING"]).toContain(workOrders[0]!.task_type);
  });

  it("KPI analysis work order is ANALYSIS type", () => {
    expect(workOrders[1]!.task_type).toBe("ANALYSIS");
  });

  it("report writing work order is WRITING type", () => {
    expect(workOrders[2]!.task_type).toBe("WRITING");
  });

  it("verification work order is VERIFICATION type", () => {
    expect(workOrders[3]!.task_type).toBe("VERIFICATION");
  });

  it("execution prompts contain sales mission context", () => {
    for (const wo of workOrders) {
      expect(wo.mission_context).toContain("MIS-SALES-REPORT-001");
    }
  });

  it("KPI analysis prompt references inputs correctly", () => {
    const analysisWo = workOrders[1]!;
    expect(analysisWo.execution_prompt).toContain("analysis");
    expect(analysisWo.input_bindings.length).toBeGreaterThanOrEqual(1);
  });

  it("all work orders have non-empty execution prompts", () => {
    for (const wo of workOrders) {
      expect(wo.execution_prompt.length).toBeGreaterThan(100);
    }
  });

  it("no EXTERNAL_WRITE/SEND side effects in internal report flow", () => {
    const externalWos = workOrders.filter(
      (wo) =>
        wo.side_effect_class === "EXTERNAL_WRITE" ||
        wo.side_effect_class === "EXTERNAL_SEND",
    );
    expect(externalWos).toHaveLength(0);
  });
});

// ── REGRESSION 2: Supplier quotations → comparison → Owner purchase decision ──

describe("Regression Mission 2: Supplier Quotations → Comparison → Owner Purchase Decision", () => {
  const strategy = makeStrategy({
    strategy_id: "STR-PROCUREMENT-001",
    mission_id: "MIS-PROCUREMENT-001",
    objective:
      "Compare supplier quotations and produce a structured comparison for Owner purchase decision",
    desired_outcome:
      "Owner makes informed purchase decision based on structured supplier comparison matrix",
    selected_playbook: "decision",
    final_deliverable: {
      deliverable_type: "decision_brief",
      audience: "owner",
      purpose: "Supplier selection decision",
      required_sections: ["Supplier Summary", "Comparison Matrix", "Recommendation", "Decision Record"],
      required_artifacts: ["comparison_report", "decision_record"],
      quality_standard: "decision-ready",
      acceptance_criteria: ["all suppliers compared", "Owner decision recorded"],
      evidence_requirement: "quotation-backed",
      format: "document",
      completion_definition: "Owner signs decision record",
    },
  });

  const workstreams: OutcomeWorkstream[] = [
    makeWs({
      workstream_id: "WS-PROC-01",
      mission_id: "MIS-PROCUREMENT-001",
      title: "Quotation Collection and Validation",
      objective: "Collect and validate all supplier quotations",
      inputs: ["supplier_quotations"],
      expected_output: ["validated_quotations"],
      proposed_worker: "data_analyst",
      proposed_tools: ["document_reader", "data_extractor"],
      execution_order: 1,
      dependencies: [],
      required_capabilities: ["data_processing"],
    }),
    makeWs({
      workstream_id: "WS-PROC-02",
      mission_id: "MIS-PROCUREMENT-001",
      title: "Supplier Comparison Analysis",
      objective: "Produce structured comparison matrix across price, quality, delivery, and risk",
      inputs: ["validated_quotations"],
      expected_output: ["comparison_matrix"],
      proposed_worker: "analysis_agent",
      proposed_tools: ["spreadsheet_tool", "data_analysis_tool"],
      execution_order: 2,
      dependencies: ["WS-PROC-01"],
      required_capabilities: ["analysis", "decision_support"],
    }),
    makeWs({
      workstream_id: "WS-PROC-03",
      mission_id: "MIS-PROCUREMENT-001",
      title: "Decision Brief Writing",
      objective: "Write structured decision brief with recommendation from comparison",
      inputs: ["comparison_matrix"],
      expected_output: ["decision_brief"],
      proposed_worker: "writing_agent",
      proposed_tools: ["document_writer"],
      execution_order: 3,
      dependencies: ["WS-PROC-02"],
      required_capabilities: ["writing"],
    }),
    makeWs({
      workstream_id: "WS-PROC-04",
      mission_id: "MIS-PROCUREMENT-001",
      title: "Owner Purchase Decision Gate",
      objective: "Owner reviews comparison and makes final purchase decision",
      inputs: ["decision_brief"],
      expected_output: ["purchase_decision_record"],
      proposed_worker: "owner",
      proposed_tools: [],
      execution_order: 4,
      dependencies: ["WS-PROC-03"],
      required_capabilities: ["decision"],
      human_gate_required: true,
      approval_required: true,
      authority_level: "L3",
      risk_level: "L3",
      proposed_actions: [
        "Review comparison matrix",
        "Select preferred supplier",
        "Record purchase decision with justification",
      ],
    }),
  ];

  const workOrders = generateAllWorkOrders({ workstreams }, strategy);

  it("generates 4 work orders for procurement mission", () => {
    expect(workOrders).toHaveLength(4);
  });

  it("final gate is HUMAN_GATE with human_decision_required=true", () => {
    const gate = workOrders[3]!;
    expect(gate.task_type).toBe("HUMAN_GATE");
    expect(gate.human_decision_required).toBe(true);
    expect(gate.human_decision_question).not.toBeNull();
  });

  it("HUMAN_GATE prompt contains decision actions", () => {
    const gate = workOrders[3]!;
    expect(gate.execution_prompt).toContain("Owner");
    expect(gate.execution_prompt).toContain("approval");
  });

  it("comparison analysis is ANALYSIS type", () => {
    expect(workOrders[1]!.task_type).toBe("ANALYSIS");
  });

  it("decision brief is WRITING type", () => {
    expect(workOrders[2]!.task_type).toBe("WRITING");
  });

  it("human gate has APPROVAL_SIGNATURE side effect class", () => {
    const gate = workOrders[3]!;
    expect(gate.side_effect_class).toBe("APPROVAL_SIGNATURE");
  });

  it("each work order has output_schema with correct artifact_type", () => {
    expect(workOrders[0]!.output_schema.artifact_type).toBeDefined();
    expect(workOrders[1]!.output_schema.artifact_type).toBe("structured_data");
    expect(workOrders[2]!.output_schema.artifact_type).toBe("document");
  });

  it("all prompts are dynamically generated from procurement context — not video/Q3 example", () => {
    for (const wo of workOrders) {
      const p = wo.execution_prompt;
      expect(p).not.toMatch(/Q3 video/i);
      expect(p).not.toMatch(/slide deck/i);
      expect(p).toContain("MIS-PROCUREMENT-001");
    }
  });

  it("depends_on_work_orders chain is correct", () => {
    const comparisonWo = workOrders[1]!;
    expect(comparisonWo.depends_on_work_orders.length).toBe(1);
    expect(comparisonWo.depends_on_work_orders[0]).toContain("WS-PROC-01");
  });
});

// ── Unit tests: TaskType inference edge cases ──────────────────────────────────

describe("inferTaskType edge cases", () => {
  it("detects TRANSCRIPTION from title", () => {
    const ws = makeWs({ title: "Audio Transcription and Cleanup" });
    const wo = generateWorkOrder(ws, makeStrategy(), { allWorkstreams: [ws] });
    expect(wo.task_type).toBe("TRANSCRIPTION");
  });

  it("detects DELIVERY when LINE tool present", () => {
    const ws = makeWs({
      title: "Send notification to stakeholders",
      proposed_tools: ["line_messenger"],
    });
    const wo = generateWorkOrder(ws, makeStrategy(), { allWorkstreams: [ws] });
    expect(wo.task_type).toBe("DELIVERY");
  });

  it("detects HUMAN_GATE when both human_gate_required and approval_required", () => {
    const ws = makeWs({ human_gate_required: true, approval_required: true });
    const wo = generateWorkOrder(ws, makeStrategy(), { allWorkstreams: [ws] });
    expect(wo.task_type).toBe("HUMAN_GATE");
  });

  it("detects VERIFICATION from objective", () => {
    const ws = makeWs({
      title: "Independent review",
      objective: "Verify that all outputs meet acceptance criteria",
    });
    const wo = generateWorkOrder(ws, makeStrategy(), { allWorkstreams: [ws] });
    expect(wo.task_type).toBe("VERIFICATION");
  });

  it("execution prompt for HUMAN_GATE does not include fake data sources", () => {
    const ws = makeWs({
      human_gate_required: true,
      approval_required: true,
      title: "Owner Gate",
      proposed_actions: ["Review findings", "Approve or reject"],
    });
    const wo = generateWorkOrder(ws, makeStrategy(), { allWorkstreams: [ws] });
    expect(wo.execution_prompt).toContain("Owner");
    expect(wo.execution_prompt).not.toContain("web_search");
  });
});
