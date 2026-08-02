import { describe, expect, it } from "vitest";
import {
  auditVisibleRequest,
  ownerVisibleRequest,
  redactForAuditDisplay,
  redactSensitiveText,
} from "@/lib/redact";

describe("owner view versus audit redaction", () => {
  const raw =
    "Please review onboarding notes. Contact ops@example.com or password: hunter2 for the staging box.";

  it("owner view keeps full confirmed request", () => {
    const owner = ownerVisibleRequest(raw);
    expect(owner.view).toBe("owner");
    expect(owner.redacted).toBe(false);
    expect(owner.text).toBe(raw);
    expect(owner.text).toContain("password: hunter2");
    expect(owner.text).toContain("ops@example.com");
  });

  it("audit view redacts sensitive values and reports rules", () => {
    const audit = auditVisibleRequest(raw);
    expect(audit.view).toBe("audit");
    expect(audit.redacted).toBe(true);
    expect(audit.text).not.toContain("hunter2");
    expect(audit.text).toContain("[redacted:credentials]");
    expect(audit.text).toContain("[redacted:personal_data]");
    expect(audit.rules_applied.some((r) => r.rule_id === "CREDENTIALS_PASSWORD")).toBe(true);
    expect(audit.rules_applied.some((r) => r.sensitivity_flag === "personal_data")).toBe(true);
  });

  it("redactForAuditDisplay attaches rule attribution for raw_request", () => {
    const out = redactForAuditDisplay({ raw_request: raw, mission_id: "MIS-1" });
    expect(String(out.raw_request)).not.toContain("hunter2");
    const meta = out.raw_request_redaction as {
      redacted: boolean;
      rules_applied: Array<{ rule_id: string }>;
    };
    expect(meta.redacted).toBe(true);
    expect(meta.rules_applied.length).toBeGreaterThan(0);
  });

  it("does not redact non-sensitive owner text unnecessarily", () => {
    const plain = "จัดทำสรุปคู่มือรับภารกิจสำหรับทีม";
    expect(redactSensitiveText(plain).redacted).toBe(false);
    expect(ownerVisibleRequest(plain).text).toBe(plain);
  });
});
