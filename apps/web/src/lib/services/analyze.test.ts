import { describe, expect, it } from "vitest";
import {
  analyzeMissionHeuristic,
  deriveMissionSuccessCriteria,
  detectLanguage,
  systemIntakeChecks,
} from "@/lib/services/analyze";

describe("mission-specific success criteria", () => {
  it("does not include system intake criteria in success_criteria", () => {
    const result = analyzeMissionHeuristic("Build a weekly ops report summarizing open blockers");
    expect(result.success_criteria.join(" ")).not.toMatch(/Mission Object created/i);
    expect(result.success_criteria.join(" ")).not.toMatch(/status=ready/);
    expect(result.success_criteria.join(" ")).not.toMatch(/User confirms understanding/i);
    expect(result.intake_validation.system_checks.length).toBeGreaterThan(0);
    expect(result.intake_validation.system_checks.some((c) => /status=ready/.test(c))).toBe(true);
  });

  it("derives criteria from desired outcome", () => {
    const criteria = deriveMissionSuccessCriteria("Ship a bilingual FAQ for the intake form", "en");
    expect(criteria[0]).toMatch(/Ship a bilingual FAQ|Done when/i);
    expect(criteria.join(" ")).not.toMatch(/Mission Object/);
  });

  it("keeps system checks separate", () => {
    const system = systemIntakeChecks("en");
    expect(system.some((c) => /system check/i.test(c))).toBe(true);
  });
});

describe("Thai-language output preservation", () => {
  it("detects Thai and preserves language without English boilerplate", () => {
    const thai = "สรุปเอกสารคู่มือการรับภารกิจสำหรับทีมปฏิบัติการ และจัดทำรายการตรวจสอบ";
    expect(detectLanguage(thai)).toBe("th");
    const result = analyzeMissionHeuristic(thai);
    expect(result.intake_validation.language).toBe("th");
    expect(result.desired_outcome).toBe(result.mission_summary);
    expect(result.desired_outcome).not.toMatch(/^Deliver a confirmed/i);
    expect(result.desired_outcome).toMatch(/สรุปเอกสาร/);
    expect(result.success_criteria.every((c) => /สำเร็จเมื่อ|[\u0E00-\u0E7F]/.test(c))).toBe(true);
    expect(result.assumptions[0].text).toMatch(/[\u0E00-\u0E7F]/);
    expect(result.draft_workstreams[0].name).toMatch(/[\u0E00-\u0E7F]/);
  });
});
