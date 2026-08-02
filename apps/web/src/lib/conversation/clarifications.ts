import type { IntakeMissionBundle } from "@/lib/schemas/intake";
import { detectLanguage } from "@/lib/services/analyze";
import type { ClarificationPrompt } from "./types";

/**
 * Build clarification prompts only for blocking unresolved blockers.
 * Up to 3 suggested answers; UI adds "Other".
 */
export function buildClarificationPrompts(bundle: IntakeMissionBundle): ClarificationPrompt[] {
  const language = detectLanguage(bundle.raw_request || bundle.mission_summary);
  const open = bundle.missing_blockers.filter((b) => b.blocking && !b.resolved);

  return open.map((b) => ({
    code: b.code,
    question: b.question,
    blocking: true,
    suggestions: suggestionsFor(b.code, language, bundle),
  }));
}

function suggestionsFor(
  code: string,
  language: "th" | "en",
  bundle: IntakeMissionBundle,
): string[] {
  if (code === "ACKNOWLEDGE_SENSITIVITY") {
    const flags = bundle.sensitivity_flags.join(", ") || "sensitivity";
    return language === "th"
      ? [
          `รับทราบธงความอ่อนไหว (${flags}) และดำเนินการต่อ`,
          "ขอแก้ไขข้อความเพื่อลดความอ่อนไหวก่อน",
          "ยกเลิกภารกิจนี้",
        ]
      : [
          `I acknowledge the sensitivity flags (${flags}) and want to continue`,
          "Let me revise the request to reduce sensitivity first",
          "Cancel this mission",
        ];
  }

  if (code === "CLARIFY_OUTPUT_FORMAT") {
    return language === "th"
      ? ["ไฟล์ PNG/สติกเกอร์ไลน์", "ชุดภาพหลายแบบ", "สเก็ตช์ก่อนผลิตจริง"]
      : ["PNG / LINE sticker pack", "Multiple style variants", "Sketch first, then produce"];
  }

  if (code === "CLARIFY_DEADLINE") {
    return language === "th"
      ? ["ภายในวันนี้", "ภายใน 3 วัน", "ยังไม่มีกำหนด"]
      : ["Today", "Within 3 days", "No hard deadline"];
  }

  return language === "th"
    ? ["ใช่ ดำเนินการต่อ", "ขอแก้ความเข้าใจ", "ยกเลิก"]
    : ["Yes, continue", "Correct the understanding", "Cancel"];
}

/**
 * Apply a clarification answer onto the bundle blockers / fields.
 * Does not invent Subtask IDs or dispatch work.
 */
export function applyClarificationAnswer(
  bundle: IntakeMissionBundle,
  code: string,
  answer: string,
): Partial<IntakeMissionBundle> {
  const language = detectLanguage(bundle.raw_request || bundle.mission_summary);
  const blockers = bundle.missing_blockers.map((b) =>
    b.code === code ? { ...b, resolved: true, answer, blocking: b.blocking } : b,
  );

  const patch: Partial<IntakeMissionBundle> = {
    missing_blockers: blockers,
  };

  if (code === "ACKNOWLEDGE_SENSITIVITY") {
    const cancel = /cancel|ยกเลิก/i.test(answer) && !/ไม่ยกเลิก|don't cancel/i.test(answer);
    const revise = /revise|แก้ไข|ลดความอ่อนไหว/i.test(answer);
    if (!cancel && !revise) {
      patch.sensitivity_acknowledged = true;
    }
  }

  if (code === "CLARIFY_OUTPUT_FORMAT") {
    patch.assumptions = [
      ...bundle.assumptions.filter((a) => a.id !== "ASM-FORMAT"),
      {
        id: "ASM-FORMAT",
        text:
          language === "th"
            ? `รูปแบบผลลัพธ์ที่ยืนยันแล้ว: ${answer}`
            : `Confirmed output format: ${answer}`,
        critical: true,
        source: "user_stated",
      },
    ];
  }

  if (code === "CLARIFY_DEADLINE") {
    if (!/no hard|ยังไม่มี/i.test(answer)) {
      // Keep free-text in assumptions; deadline ISO only if clearly parseable later
      patch.assumptions = [
        ...bundle.assumptions.filter((a) => a.id !== "ASM-DEADLINE"),
        {
          id: "ASM-DEADLINE",
          text:
            language === "th" ? `กำหนดเวลาจากผู้ใช้: ${answer}` : `User-stated timing: ${answer}`,
          critical: true,
          source: "user_stated",
        },
      ];
    }
  }

  return patch;
}
