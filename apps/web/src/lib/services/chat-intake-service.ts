import { z } from "zod";
import type { IntakeMissionBundle } from "@/lib/schemas/intake";
import {
  analyzeIntake,
  cancelIntake,
  confirmIntake,
  correctIntake,
  createIntake,
} from "@/lib/services/intake-service";
import { evaluateReadiness } from "@/lib/gates/readiness-gate";
import { analyzeMissionHeuristic, detectLanguage } from "@/lib/services/analyze";
import { getRepository } from "@/lib/repositories";
import { newIdempotencyKey, nowIso } from "@/lib/ids";
import { DraftCorrectionSchema } from "@/lib/schemas/draft-correction";
import {
  applyClarificationAnswer,
  buildClarificationPrompts,
} from "@/lib/conversation/clarifications";
import {
  readinessToConversation,
  withConversationRef,
  getConversationRef,
  type ChatMessage,
  type ConversationState,
  type ClarificationPrompt,
} from "@/lib/conversation/types";

export const ChatTurnRequestSchema = z.object({
  message: z.string().min(1).max(20000),
  intake_id: z.string().optional(),
  idempotency_key: z.string().optional(),
  deadline: z.string().datetime().nullable().optional(),
  constraints: z.array(z.string()).optional(),
  attachments: z.array(z.record(z.string(), z.unknown())).optional(),
  /** When answering a clarification prompt */
  clarification_code: z.string().optional(),
});

export type ChatTurnRequest = z.infer<typeof ChatTurnRequestSchema>;

export type ChatTurnResponse = {
  ok: true;
  intake_id: string | null;
  conversation_state: ConversationState;
  readiness_status: IntakeMissionBundle["readiness_status"] | null;
  messages: ChatMessage[];
  clarifications: ClarificationPrompt[];
  bundle: IntakeMissionBundle | null;
  draft: DraftMissionPanel | null;
};

export type DraftMissionPanel = {
  mission_summary: string;
  desired_outcome: string;
  success_criteria: string[];
  constraints: string[];
  assumptions: IntakeMissionBundle["assumptions"];
  missing_blockers: IntakeMissionBundle["missing_blockers"];
  draft_workstreams: IntakeMissionBundle["draft_workstreams"];
  capability_families: string[];
  operational_risk: string;
  sensitivity_flags: string[];
  data_destinations: IntakeMissionBundle["data_destinations"];
  approval_requirements: IntakeMissionBundle["approval_requirements"];
  readiness_status: string;
  language: "th" | "en";
};

function msg(
  role: ChatMessage["role"],
  content: string,
  kind?: ChatMessage["kind"],
  extra?: Partial<ChatMessage>,
): ChatMessage {
  return {
    id: `msg-${crypto.randomUUID()}`,
    role,
    content,
    created_at: nowIso(),
    kind,
    ...extra,
  };
}

function welcomeMessages(language: "th" | "en" = "en"): ChatMessage[] {
  if (language === "th") {
    return [
      msg(
        "commander",
        "สวัสดีครับ ผมคือ Mission Commander ของ AIPOS — ผู้ช่วยหัวหน้าฝ่ายปฏิบัติการด้านภารกิจ\nเล่าภารกิจที่ต้องการทำเป็นภาษาธรรมชาติได้เลย ผมจะสรุปความเข้าใจ และถามเฉพาะประเด็นที่จำเป็นก่อนยืนยันภารกิจ",
        "welcome",
      ),
    ];
  }
  return [
    msg(
      "commander",
      "Hello — I'm the AIPOS Mission Commander, your AI Chief of Staff for mission intake.\nDescribe a mission in natural language. I'll summarize my understanding and ask only questions that block readiness before you confirm.",
      "welcome",
    ),
  ];
}

export function buildDraftPanel(bundle: IntakeMissionBundle): DraftMissionPanel {
  const language = detectLanguage(bundle.raw_request || bundle.mission_summary);
  return {
    mission_summary: bundle.mission_summary,
    desired_outcome: bundle.desired_outcome,
    success_criteria: bundle.success_criteria,
    constraints: bundle.constraints,
    assumptions: bundle.assumptions,
    missing_blockers: bundle.missing_blockers,
    draft_workstreams: bundle.draft_workstreams,
    capability_families: bundle.capability_families,
    operational_risk: bundle.operational_risk,
    sensitivity_flags: bundle.sensitivity_flags,
    data_destinations: bundle.data_destinations,
    approval_requirements: bundle.approval_requirements,
    readiness_status: bundle.readiness_status,
    language,
  };
}

function understandingMessage(bundle: IntakeMissionBundle): ChatMessage {
  const lang = detectLanguage(bundle.raw_request || bundle.mission_summary);
  const assumptions = bundle.assumptions
    .map((a) => `• [${a.source}${a.critical ? ", critical" : ""}] ${a.text}`)
    .join("\n");
  const criteria = bundle.success_criteria.map((c) => `• ${c}`).join("\n");
  const ws = bundle.draft_workstreams.map((w) => `• ${w.id} ${w.name} — ${w.purpose}`).join("\n");

  if (lang === "th") {
    return msg(
      "commander",
      [
        "นี่คือความเข้าใจภารกิจของผม (ยังไม่สร้าง Mission Object จนกว่าคุณจะยืนยัน):",
        "",
        `สรุป: ${bundle.mission_summary}`,
        `ผลลัพธ์ที่ต้องการ: ${bundle.desired_outcome}`,
        `เกณฑ์สำเร็จของภารกิจ:\n${criteria}`,
        bundle.constraints.length ? `ข้อจำกัด: ${bundle.constraints.join("; ")}` : "ข้อจำกัด: —",
        `สมมติฐาน (แยกจากข้อเท็จจริงที่ยืนยัน):\n${assumptions || "• —"}`,
        `ความเสี่ยงปฏิบัติการ: ${bundle.operational_risk}`,
        `ธงความอ่อนไหว: ${bundle.sensitivity_flags.join(", ") || "ไม่มี"}`,
        `กลุ่มความสามารถ: ${bundle.capability_families.join(", ") || "—"}`,
        `Draft Work Map:\n${ws}`,
        "",
        "ยืนยันได้เมื่อพร้อม หรือบอกให้ผมแก้ความเข้าใจ — จะไม่สร้าง Subtask จริงในขั้นตอนนี้",
      ].join("\n"),
      "understanding",
    );
  }

  return msg(
    "commander",
    [
      "Here is my mission understanding (no Mission Object until you confirm):",
      "",
      `Summary: ${bundle.mission_summary}`,
      `Desired outcome: ${bundle.desired_outcome}`,
      `Mission success criteria:\n${criteria}`,
      bundle.constraints.length
        ? `Constraints: ${bundle.constraints.join("; ")}`
        : "Constraints: —",
      `Assumptions (distinct from confirmed facts):\n${assumptions || "• —"}`,
      `Operational risk: ${bundle.operational_risk}`,
      `Sensitivity flags: ${bundle.sensitivity_flags.join(", ") || "none"}`,
      `Capability families: ${bundle.capability_families.join(", ") || "—"}`,
      `Draft Work Map:\n${ws}`,
      "",
      "Confirm when ready, or ask me to correct the understanding — no real Subtasks are created at intake.",
    ].join("\n"),
    "understanding",
  );
}

async function persistConversation(
  bundle: IntakeMissionBundle,
  state: ConversationState,
  messages: ChatMessage[],
): Promise<IntakeMissionBundle> {
  const updated = withConversationRef(bundle, state, messages);
  await getRepository().saveIntake(updated);
  return updated;
}

/**
 * Chat-first turn against existing intake services (create/analyze/correct).
 */
export async function handleChatTurn(
  input: ChatTurnRequest,
  actor: string,
): Promise<ChatTurnResponse> {
  const parsed = ChatTurnRequestSchema.parse(input);
  const languageHint = detectLanguage(parsed.message);

  // --- Answer clarification on existing intake ---
  if (parsed.intake_id && parsed.clarification_code) {
    const repo = getRepository();
    const existing = await repo.getIntakeById(parsed.intake_id);
    if (!existing) {
      return emptyError("Intake not found");
    }
    const prior = getConversationRef(existing);
    const messages = [
      ...(prior?.messages ?? welcomeMessages(languageHint)),
      msg("user", parsed.message, "mission"),
    ];

    const patch = applyClarificationAnswer(existing, parsed.clarification_code, parsed.message);

    // Cancel shortcut
    if (
      parsed.clarification_code === "ACKNOWLEDGE_SENSITIVITY" &&
      /cancel|ยกเลิก/i.test(parsed.message)
    ) {
      await cancelIntake(existing.intake_id, actor, "Cancelled via chat clarification");
      const cancelledMsgs = [
        ...messages,
        msg(
          "commander",
          languageHint === "th" ? "ยกเลิกภารกิจนี้แล้ว" : "This intake has been cancelled.",
          "status",
        ),
      ];
      return {
        ok: true,
        intake_id: existing.intake_id,
        conversation_state: "cancelled",
        readiness_status: "needs_input",
        messages: cancelledMsgs,
        clarifications: [],
        bundle: existing,
        draft: buildDraftPanel(existing),
      };
    }

    const corrected = await correctIntake(existing.intake_id, patch, actor);
    return finalizeAfterAnalysis(corrected, messages);
  }

  // --- New mission message ---
  if (!parsed.intake_id) {
    const messages = [
      ...welcomeMessages(languageHint),
      msg("user", parsed.message, "mission"),
      msg(
        "commander",
        languageHint === "th" ? "กำลังวิเคราะห์ภารกิจ…" : "Analyzing your mission…",
        "status",
      ),
    ];

    const { bundle } = await createIntake(
      {
        raw_request: parsed.message,
        deadline: parsed.deadline ?? null,
        constraints: parsed.constraints,
        attachments: parsed.attachments,
        idempotency_key: parsed.idempotency_key || newIdempotencyKey(),
      },
      actor,
    );
    const analyzed = await analyzeIntake(bundle.intake_id, actor);
    // Drop the transient "analyzing…" status for stored history; replace with result msgs
    const baseMsgs = messages.filter((m) => m.kind !== "status");
    return finalizeAfterAnalysis(analyzed, baseMsgs);
  }

  // --- Follow-up free text on existing intake (treat as correction note / clarification) ---
  const repo = getRepository();
  const existing = await repo.getIntakeById(parsed.intake_id);
  if (!existing) return emptyError("Intake not found");

  const prior = getConversationRef(existing);
  const messages = [
    ...(prior?.messages ?? welcomeMessages(languageHint)),
    msg("user", parsed.message, "mission"),
  ];

  const open = buildClarificationPrompts(existing);
  if (open.length > 0) {
    // Apply to first open clarification if user typed freely
    const patch = applyClarificationAnswer(existing, open[0].code, parsed.message);
    const corrected = await correctIntake(existing.intake_id, patch, actor);
    return finalizeAfterAnalysis(corrected, messages);
  }

  // Otherwise append as constraint/correction to summary note
  const corrected = await correctIntake(
    existing.intake_id,
    {
      constraints: [...existing.constraints, parsed.message],
      assumptions: [
        ...existing.assumptions,
        {
          id: `ASM-CHAT-${existing.assumptions.length + 1}`,
          text:
            detectLanguage(parsed.message) === "th"
              ? `ข้อความเพิ่มจากผู้ใช้: ${parsed.message}`
              : `User follow-up: ${parsed.message}`,
          critical: false,
          source: "user_stated",
        },
      ],
    },
    actor,
  );
  return finalizeAfterAnalysis(corrected, messages);
}

async function finalizeAfterAnalysis(
  bundle: IntakeMissionBundle,
  priorMessages: ChatMessage[],
): Promise<ChatTurnResponse> {
  const lang = detectLanguage(bundle.raw_request || bundle.mission_summary);
  const readiness = evaluateReadiness(bundle);
  const working: IntakeMissionBundle = {
    ...bundle,
    readiness_status: readiness.readiness_status,
  };

  const clarifications = buildClarificationPrompts(working);
  let state = readinessToConversation(working);
  const messages = [...priorMessages];

  if (clarifications.length > 0) {
    state = "needs_clarification";
    for (const c of clarifications) {
      messages.push(
        msg("commander", c.question, "clarification", {
          clarification_code: c.code,
          suggestions: c.suggestions,
        }),
      );
    }
  } else {
    state =
      working.readiness_status === "awaiting_confirmation"
        ? "awaiting_confirmation"
        : "presenting_understanding";
    messages.push(understandingMessage(working));
    messages.push(
      msg(
        "commander",
        lang === "th"
          ? "พร้อมยืนยันภารกิจ หรือต้องการแก้ความเข้าใจไหม?"
          : "Ready to confirm this mission, or should I correct the understanding?",
        "status",
      ),
    );
  }

  const saved = await persistConversation(working, state, messages);
  return {
    ok: true,
    intake_id: saved.intake_id,
    conversation_state: state,
    readiness_status: saved.readiness_status,
    messages,
    clarifications,
    bundle: saved,
    draft: buildDraftPanel(saved),
  };
}

function emptyError(message: string): ChatTurnResponse {
  return {
    ok: true,
    intake_id: null,
    conversation_state: "awaiting_mission",
    readiness_status: null,
    messages: [msg("system", message, "error")],
    clarifications: [],
    bundle: null,
    draft: null,
  };
}

export async function confirmChatIntake(
  intakeId: string,
  actor: string,
  sensitivity_acknowledged?: boolean,
) {
  const result = await confirmIntake(
    intakeId,
    {
      sensitivity_acknowledged,
      reason: "User confirmed mission via Mission Commander chat",
    },
    actor,
  );
  return result;
}

export function initialChatSession(language: "th" | "en" = "en"): ChatTurnResponse {
  return {
    ok: true,
    intake_id: null,
    conversation_state: "awaiting_mission",
    readiness_status: null,
    messages: welcomeMessages(language),
    clarifications: [],
    bundle: null,
    draft: null,
  };
}

/** Read-only resume: never interpret a missing ID as permission to create. */
export async function resumeChatIntake(intakeId: string): Promise<ChatTurnResponse> {
  const bundle = await getRepository().getIntakeById(intakeId);
  if (!bundle) throw new Error("INTAKE_NOT_FOUND");
  const prior = getConversationRef(bundle);
  return {
    ok: true,
    intake_id: bundle.intake_id,
    conversation_state:
      bundle.readiness_status === "cancelled"
        ? "cancelled"
        : bundle.confirmed_by_user
          ? "ready_to_dispatch"
          : readinessToConversation(bundle),
    readiness_status: bundle.readiness_status,
    messages: prior?.messages ?? [understandingMessage(bundle)],
    clarifications: buildClarificationPrompts(bundle),
    bundle,
    draft: buildDraftPanel(bundle),
  };
}

/** Bounded correction of an existing draft; authority fields are never accepted. */
export async function correctChatDraft(input: unknown, actor: string): Promise<ChatTurnResponse> {
  const parsed = DraftCorrectionSchema.parse(input);
  const repo = getRepository();
  const existing = await repo.getIntakeById(parsed.intake_id);
  if (!existing) throw new Error("INTAKE_NOT_FOUND");
  if (existing.confirmed_by_user) throw new Error("INTAKE_ALREADY_CONFIRMED");
  if (existing.readiness_status === "cancelled") throw new Error("INTAKE_CANCELLED");
  if (existing.updated_at !== parsed.expected_updated_at) throw new Error("INTAKE_STALE");
  const retainedIds = new Set(parsed.workstreams.map((w) => w.id));
  // Keep all prior approval requirements even when a draft workstream is removed.
  const approvals = [...new Set(existing.draft_workstreams.flatMap((w) => w.approval_points))];
  const workstreams = parsed.workstreams.map((w) => {
    const original = existing.draft_workstreams.find((row) => row.id === w.id);
    if (!original) throw new Error("INTAKE_WORKSTREAM_UNKNOWN");
    return {
      ...original,
      ...w,
      approval_points: approvals,
      depends_on_ws: original.depends_on_ws.filter((id) => retainedIds.has(id)),
    };
  });
  // Corrections may introduce sensitive content: only escalate, never auto-clear.
  const safety = analyzeMissionHeuristic(
    [
      parsed.mission_summary,
      parsed.desired_outcome,
      ...parsed.success_criteria,
      ...parsed.constraints,
      ...parsed.workstreams.flatMap((w) => [w.name, w.purpose, ...w.expected_outputs]),
    ].join("\n"),
  );
  const newFlags = safety.sensitivity_flags.some(
    (flag) => !existing.sensitivity_flags.includes(flag),
  );
  const missingBlockers = newFlags
    ? [
        ...existing.missing_blockers.filter((b) => b.code !== "ACKNOWLEDGE_SENSITIVITY"),
        {
          code: "ACKNOWLEDGE_SENSITIVITY",
          question: "พบธงความอ่อนไหวเพิ่มเติม กรุณาตรวจและรับทราบก่อนยืนยัน",
          blocking: true,
          resolved: false,
        },
      ]
    : existing.missing_blockers;
  const corrected = await correctIntake(
    existing.intake_id,
    {
      mission_summary: parsed.mission_summary,
      desired_outcome: parsed.desired_outcome,
      success_criteria: parsed.success_criteria,
      constraints: parsed.constraints,
      draft_workstreams: workstreams,
      operational_risk:
        safety.operational_risk > existing.operational_risk
          ? safety.operational_risk
          : existing.operational_risk,
      sensitivity_flags: [...new Set([...existing.sensitivity_flags, ...safety.sensitivity_flags])],
      sensitivity_acknowledged: newFlags ? false : existing.sensitivity_acknowledged,
      missing_blockers: missingBlockers,
    },
    actor,
  );
  return finalizeAfterAnalysis(corrected, [
    ...(getConversationRef(existing)?.messages ?? []),
    msg("user", "บันทึกการแก้ไขร่างเดิม — ยังไม่ยืนยันหรือส่งงาน", "status"),
  ]);
}
