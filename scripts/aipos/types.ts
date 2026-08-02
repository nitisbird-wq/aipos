export type CheckStatus = "PASS" | "FAIL" | "WARN" | "INFO" | "NA";
export type Severity = "Critical" | "High" | "Medium" | "Low" | "Info";
export type DoctorProfile = "local" | "pr" | "production";

export type AuditCheck = {
  category: string;
  name: string;
  status: CheckStatus;
  severity: Severity;
  detail: string;
};

export type OverallStatus =
  | "READY"
  | "CONDITIONALLY READY"
  | "REQUIRES ACTION"
  | "NOT READY";

export type AuditResult = {
  generated_at: string;
  project_path: string;
  profile: DoctorProfile;
  overall: OverallStatus;
  checks: AuditCheck[];
  summary: {
    pass: number;
    fail: number;
    warn: number;
    na: number;
    critical: number;
    high: number;
    medium: number;
  };
  exit_code: number;
};

export function pass(
  category: string,
  name: string,
  detail: string,
  severity: Severity = "Info",
): AuditCheck {
  return { category, name, status: "PASS", severity, detail };
}

export function fail(
  category: string,
  name: string,
  detail: string,
  severity: Severity = "High",
): AuditCheck {
  return { category, name, status: "FAIL", severity, detail };
}

export function warn(
  category: string,
  name: string,
  detail: string,
  severity: Severity = "Medium",
): AuditCheck {
  return { category, name, status: "WARN", severity, detail };
}

export function na(
  category: string,
  name: string,
  detail: string,
): AuditCheck {
  return { category, name, status: "NA", severity: "Info", detail };
}

export function summarize(checks: AuditCheck[]): AuditResult["summary"] {
  const actionable = checks.filter((c) => c.status !== "NA");
  return {
    pass: checks.filter((c) => c.status === "PASS").length,
    fail: checks.filter((c) => c.status === "FAIL").length,
    warn: checks.filter((c) => c.status === "WARN").length,
    na: checks.filter((c) => c.status === "NA").length,
    critical: actionable.filter((c) => c.severity === "Critical" && c.status === "FAIL").length,
    high: actionable.filter((c) => c.severity === "High" && c.status === "FAIL").length,
    medium: actionable.filter(
      (c) => c.severity === "Medium" && (c.status === "FAIL" || c.status === "WARN"),
    ).length,
  };
}

export function overallFrom(summary: AuditResult["summary"]): OverallStatus {
  if (summary.critical > 0) return "NOT READY";
  if (summary.high > 0) return "REQUIRES ACTION";
  if (summary.medium > 0) return "CONDITIONALLY READY";
  return "READY";
}

/** Soft High names for PR profile (cannot verify / non-blocking early). */
const PR_SOFT_HIGH = new Set([
  "Branch protection",
  "Branch naming",
]);

function isSoftHigh(check: AuditCheck, profile: DoctorProfile): boolean {
  if (check.severity !== "High" || check.status !== "FAIL") return false;
  if (profile === "local") return true; // local: High advisory; Critical only blocks exit
  if (profile === "pr") return PR_SOFT_HIGH.has(check.name);
  return false;
}

/**
 * Exit codes for CI:
 * 0 = pass under profile policy
 * 1 = High/Medium violation under profile
 * 2 = Critical
 */
export function exitCodeFor(
  checks: AuditCheck[],
  summary: AuditResult["summary"],
  profile: DoctorProfile,
): number {
  if (summary.critical > 0) return 2;

  if (profile === "local") {
    // Local development: Critical only. High/Medium are advisory.
    return 0;
  }

  const highFails = checks.filter(
    (c) => c.status === "FAIL" && c.severity === "High" && !isSoftHigh(c, profile),
  );
  if (highFails.length > 0) return 1;

  if (profile === "production") {
    const mediumIssues = checks.filter(
      (c) =>
        c.status !== "NA" &&
        c.status !== "PASS" &&
        (c.severity === "Medium" || c.severity === "High"),
    );
    if (mediumIssues.length > 0) return 1;
  }

  return 0;
}

export function parseProfile(raw: string | undefined): DoctorProfile {
  const v = (raw || "local").toLowerCase();
  if (v === "local" || v === "local-development" || v === "dev") return "local";
  if (v === "pr" || v === "pull-request" || v === "ci") return "pr";
  if (v === "production" || v === "production-readiness" || v === "prod") return "production";
  throw new Error(`Unknown doctor profile: ${raw}. Use local | pr | production`);
}
