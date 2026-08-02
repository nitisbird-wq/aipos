import type { IntakeMissionBundle, OperationalRisk, SensitivityFlag } from "@/lib/schemas/intake";

export type AnalyzeResult = Pick<
  IntakeMissionBundle,
  | "mission_summary"
  | "desired_outcome"
  | "success_criteria"
  | "assumptions"
  | "missing_blockers"
  | "draft_workstreams"
  | "capability_families"
  | "operational_risk"
  | "sensitivity_flags"
  | "approval_requirements"
  | "data_handling_requirements"
> & {
  /** System intake validation — not mission outcome success criteria */
  intake_validation: {
    language: "th" | "en";
    system_checks: string[];
    gate_hints: string[];
  };
};

const THAI_RE = /[\u0E00-\u0E7F]/;

export function detectLanguage(text: string): "th" | "en" {
  return THAI_RE.test(text) ? "th" : "en";
}

function truncateSummary(raw: string, max = 160): string {
  const trimmed = raw.trim();
  return trimmed.length > max ? `${trimmed.slice(0, max - 3)}...` : trimmed;
}

/**
 * Mission outcome criteria derived from the user's desired outcome / request.
 * Never includes system intake checks (confirm, mapping, status=ready).
 */
export function deriveMissionSuccessCriteria(
  desiredOutcome: string,
  language: "th" | "en",
): string[] {
  const outcome = desiredOutcome.trim();
  if (!outcome) {
    return language === "th"
      ? ["ผลลัพธ์ของภารกิจได้รับการส่งมอบตามที่ระบุ"]
      : ["Requested mission outcome is delivered as specified"];
  }

  // Split on sentence/clause boundaries while preserving language
  const parts = outcome
    .split(/[\n.;]|และ|and then|then/i)
    .map((p) => p.trim())
    .filter((p) => p.length > 8);

  if (parts.length >= 2) {
    return parts
      .slice(0, 4)
      .map((p) => (language === "th" ? `สำเร็จเมื่อ: ${p}` : `Done when: ${p}`));
  }

  return language === "th"
    ? [`สำเร็จเมื่อได้ผลลัพธ์: ${outcome}`]
    : [`Done when outcome is achieved: ${outcome}`];
}

/** System intake criteria — stored under intake_validation / gate_results only */
export function systemIntakeChecks(language: "th" | "en"): string[] {
  if (language === "th") {
    return [
      "ผู้ใช้ยืนยันความเข้าใจภารกิจ",
      "ผ่าน Readiness / Handling / Mapping Gate",
      "สร้าง Mission Object ด้วย status=ready (เกณฑ์ระบบ ไม่ใช่ผลลัพธ์ภารกิจ)",
    ];
  }
  return [
    "User confirms understanding",
    "Readiness / Handling / Mapping gates pass",
    "Mission Object created with status=ready (system check, not mission outcome)",
  ];
}

/**
 * Deterministic heuristic analyze stub (ANALYZE_PROVIDER=none).
 * Preserves Thai when the request is Thai; no English boilerplate prepended.
 */
export function analyzeMissionHeuristic(
  rawRequest: string,
  constraints: string[] = [],
): AnalyzeResult {
  const language = detectLanguage(rawRequest);
  const text = rawRequest.toLowerCase();
  const families = new Set<string>();
  const flags = new Set<SensitivityFlag>();
  let risk: OperationalRisk = "L0";

  const familyRules: Array<[RegExp, string]> = [
    [/\b(code|implement|bug|refactor|typescript|next\.?js|api)\b/, "code"],
    [/(โค้ด|พัฒน|โปรแกรม|typescript|next\.?js|api)/, "code"],
    [/\b(summar(y|ize)|document|docs|readme)\b/, "docs"],
    [/(สรุป|เอกสาร|docs|readme)/, "docs"],
    [/\b(deck|slides?|presentation|pitch)\b/, "deck"],
    [/(สไลด์|พรีเซนต์|นำเสนอ)/, "deck"],
    [/\b(design|graphic|brand|logo|sticker)\b/, "design"],
    [/(ออกแบบ|กราฟิก|โลโก้|สติกเกอร์|การ์ตูน|sticker)/, "design"],
    [/\b(video|runway|kling)\b/, "video"],
    [/(วิดีโอ|คลิป)/, "video"],
    [/\b(automat(e|ion)|n8n|workflow)\b/, "automation"],
    [/(อัตโนมัติ|เวิร์กโฟลว์|workflow)/, "automation"],
    [/\b(research|synthesize|literature)\b/, "research"],
    [/(วิจัย|สังเคราะห์)/, "research"],
    [/\b(strateg(y|ic)|analyze market)\b/, "strategy_analysis"],
    [/(กลยุทธ์|วิเคราะห์)/, "strategy_analysis"],
    [/\b(notion|knowledge|kb)\b/, "knowledge_management"],
    [/(ความรู้|โนชัน|notion)/, "knowledge_management"],
    [/\b(data analysis|analytics|dashboard metrics)\b/, "data_analysis"],
    [/(วิเคราะห์ข้อมูล|แดชบอร์ด)/, "data_analysis"],
    [/\b(sop|process design)\b/, "workflow_design"],
    [/(กระบวนการ|sop)/, "workflow_design"],
    [/\b(police|case file|investigation)\b/, "domain.police"],
    [/(ตำรวจ|คดี)/, "domain.police"],
    [/\b(legal|attorney|privileged)\b/, "domain.legal"],
    [/(กฎหมาย|ทนาย)/, "domain.legal"],
    [/\b(business|revenue|pricing)\b/, "domain.business"],
    [/(ธุรกิจ|รายได้)/, "domain.business"],
  ];

  for (const [re, family] of familyRules) {
    if (re.test(text) || re.test(rawRequest)) families.add(family);
  }
  if (families.size === 0) families.add("docs");

  const flagRules: Array<[RegExp, SensitivityFlag]> = [
    [/\b(ssn|passport|email address|phone|personal)\b/, "personal_data"],
    [/(ข้อมูลส่วนบุคคล|บัตรประชาชน|เบอร์โทร)/, "personal_data"],
    [/\b(police|case number|investigation)\b/, "police_case_data"],
    [/(คดีตำรวจ|หมายเลขคดี)/, "police_case_data"],
    [/\b(legal|attorney|privileged)\b/, "legal_privileged"],
    [/(ความลับทางกฎหมาย|ทนาย)/, "legal_privileged"],
    [/\b(invoice|payment|bank|financial)\b/, "financial"],
    [/(การเงิน|บัญชีธนาคาร|ใบแจ้งหนี้)/, "financial"],
    [/\b(password|api key|token|credential|secret)\b/, "credentials"],
    [/(รหัสผ่าน|โทเคน|คีย์ api|ความลับ)/, "credentials"],
    [/\b(health|medical|hipaa)\b/, "health"],
    [/(สุขภาพ|การแพทย์)/, "health"],
    [/\b(minor|child|underage)\b/, "minors"],
    [/(เด็ก|ผู้เยาว์)/, "minors"],
    [/\b(confidential|internal only)\b/, "internal_confidential"],
    [/(ลับภายใน|ภายในเท่านั้น)/, "internal_confidential"],
    [/\b(press|public|reputation|announce)\b/, "public_reputation"],
    [/(ชื่อเสียง|แถลง|สาธารณะ)/, "public_reputation"],
    [/\b(production|prod|deploy|live system)\b/, "production_system"],
    [/(โปรดักชัน|deploy|ระบบจริง)/, "production_system"],
  ];
  for (const [re, flag] of flagRules) {
    if (re.test(text) || re.test(rawRequest)) flags.add(flag);
  }

  if (
    /\b(deploy|publish|send email|merge|schedule|live)\b/.test(text) ||
    /(เผยแพร่|deploy|ส่งอีเมล)/.test(rawRequest)
  )
    risk = "L3";
  else if (
    /\b(write|update|store|persist|save to)\b/.test(text) ||
    /(บันทึก|อัปเดต|เขียน)/.test(rawRequest)
  )
    risk = "L2";
  else if (/\b(draft|revise|create)\b/.test(text) || /(ร่าง|สร้าง|แก้ไข)/.test(rawRequest))
    risk = "L1";
  if (
    /\b(legal|financial|safety|access control|critical)\b/.test(text) ||
    /(กฎหมาย|การเงิน|วิกฤต)/.test(rawRequest)
  )
    risk = "L4";
  if (flags.has("credentials") || flags.has("police_case_data")) {
    if (risk < "L2") risk = "L2";
  }

  const summary = truncateSummary(rawRequest);
  // Desired outcome = user's request intent, no English boilerplate prefix
  const desired_outcome = summary;

  const success_criteria = deriveMissionSuccessCriteria(desired_outcome, language);
  const system_checks = systemIntakeChecks(language);

  const blockers = [];
  const hasExplicitCriteria =
    language === "th"
      ? /(เกณฑ์|สำเร็จเมื่อ|ตัวชี้วัด)/.test(rawRequest)
      : /\b(success|done when|acceptance|criteria)\b/i.test(rawRequest);

  // Non-blocking: inferred criteria become assumptions, not forced questions
  if (!hasExplicitCriteria) {
    blockers.push({
      code: "CLARIFY_SUCCESS_CRITERIA",
      question:
        language === "th"
          ? "ผลลัพธ์ที่วัดได้เมื่อภารกิจเสร็จคืออะไร?"
          : "What measurable outcome confirms this mission is complete?",
      blocking: false,
      resolved: true,
      answer:
        language === "th"
          ? "อนุมานจากข้อความคำขอ (ฮิวริสติก) — ไม่ถามซ้ำถ้าไม่บล็อก readiness"
          : "Inferred from request text (heuristic) — not re-asked unless blocking",
    });
  }

  // Blocking: sensitivity acknowledgment only when flags present
  if (flags.size > 0) {
    blockers.push({
      code: "ACKNOWLEDGE_SENSITIVITY",
      question:
        language === "th"
          ? "โปรดยืนยันการรับทราบธงความอ่อนไหวก่อนยืนยันภารกิจ"
          : "Acknowledge sensitivity flags before confirmation.",
      blocking: true,
      resolved: false,
    });
  }

  // Blocking: output format for design/sticker missions when format not stated
  const isDesign = families.has("design");
  const hasFormat =
    language === "th"
      ? /(png|jpg|webp|ไฟล์\s*png|รูปแบบไฟล์|แพ็กสติกเกอร์)/i.test(rawRequest)
      : /\b(png|jpg|webp|sticker pack|file type|output format)\b/i.test(rawRequest);
  if (isDesign && !hasFormat) {
    blockers.push({
      code: "CLARIFY_OUTPUT_FORMAT",
      question:
        language === "th"
          ? "ต้องการรูปแบบผลลัพธ์แบบใดสำหรับงานออกแบบ/สติกเกอร์นี้?"
          : "What output format do you need for this design/sticker work?",
      blocking: true,
      resolved: false,
    });
  }

  // Blocking deadline only when urgency is stated without a concrete time
  const urgent =
    language === "th"
      ? /(ด่วน|วันนี้|เร่ง)/.test(rawRequest)
      : /\b(urgent|asap|today|immediately)\b/i.test(rawRequest);
  if (urgent) {
    blockers.push({
      code: "CLARIFY_DEADLINE",
      question: language === "th" ? "ต้องการกำหนดส่งเมื่อใด?" : "What deadline should we use?",
      blocking: true,
      resolved: false,
    });
  }

  const capability_families = Array.from(families);
  const draft_workstreams =
    language === "th"
      ? [
          {
            id: "WS1",
            name: "ทำความเข้าใจและกำหนดขอบเขต",
            purpose: "ยืนยันความเข้าใจและข้อจำกัด",
            expected_outputs: ["ความเข้าใจภารกิจที่ยืนยันแล้ว"],
            capability_families: ["docs"],
            depends_on_ws: [] as string[],
            approval_points: ["user_confirmation"],
            notes: "Draft workstream ของ Intake MVP เท่านั้น — ไม่มี Subtask ID",
          },
          {
            id: "WS2",
            name: "สร้างผลงานหลัก",
            purpose: "จัดทำผลลัพธ์หลักของภารกิจ",
            expected_outputs: ["ร่างผลงานหลัก"],
            capability_families,
            depends_on_ws: ["WS1"],
            approval_points: risk >= "L3" ? ["authority_approval"] : [],
            notes: "ยังไม่ดำเนินการใน Intake MVP",
          },
        ]
      : [
          {
            id: "WS1",
            name: "Understand & scope",
            purpose: "Confirm understanding and constraints",
            expected_outputs: ["Confirmed mission understanding"],
            capability_families: ["docs"],
            depends_on_ws: [] as string[],
            approval_points: ["user_confirmation"],
            notes: "Intake MVP draft workstream only — no Subtask IDs",
          },
          {
            id: "WS2",
            name: "Produce primary deliverable",
            purpose: "Create the main draft output for the mission",
            expected_outputs: ["Primary draft artifact"],
            capability_families,
            depends_on_ws: ["WS1"],
            approval_points: risk >= "L3" ? ["authority_approval"] : [],
            notes: "Not executed in Intake MVP",
          },
        ];

  const handling = ["references_over_payloads"];
  if (flags.size > 0) handling.push("redact_in_audit_display");

  return {
    mission_summary: summary,
    desired_outcome,
    success_criteria,
    assumptions: [
      {
        id: "ASM-1",
        text:
          language === "th"
            ? "การวิเคราะห์ใช้ฮิวริสติกแบบกำหนดได้ (ไม่มี LLM ภายนอก)"
            : "Analysis produced by deterministic heuristic stub (no external LLM).",
        critical: false,
        source: "inferred",
      },
      ...(constraints.length
        ? [
            {
              id: "ASM-2",
              text:
                language === "th"
                  ? `ข้อจำกัดจากผู้ใช้: ${constraints.join("; ")}`
                  : `User constraints provided: ${constraints.join("; ")}`,
              critical: true,
              source: "user_stated" as const,
            },
          ]
        : []),
    ],
    missing_blockers: blockers,
    draft_workstreams,
    capability_families,
    operational_risk: risk,
    sensitivity_flags: Array.from(flags),
    approval_requirements:
      risk >= "L3"
        ? [
            {
              type: "authority_approval",
              reason: language === "th" ? "ความเสี่ยงปฏิบัติการ L3+" : "Operational risk L3+",
            },
          ]
        : [],
    data_handling_requirements: handling,
    intake_validation: {
      language,
      system_checks,
      gate_hints: ["readiness", "handling", "mapping"],
    },
  };
}
