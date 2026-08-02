import path from "node:path";
import { checkGit } from "./checks/git";
import { checkSecurity } from "./checks/security";
import { checkGovernance } from "./checks/governance";
import { checkQuality } from "./checks/quality";
import { checkN8n } from "./checks/n8n";
import { checkCicd } from "./checks/cicd";
import { printConsole, writeReport } from "./report";
import {
  exitCodeFor,
  overallFrom,
  summarize,
  type AuditResult,
  type DoctorProfile,
} from "./types";

export function runDoctor(
  projectRoot = process.cwd(),
  profile: DoctorProfile = "local",
): AuditResult {
  const root = path.resolve(projectRoot);
  const checks = [
    ...checkGit(root),
    ...checkSecurity(root),
    ...checkGovernance(root),
    ...checkQuality(root),
    ...checkN8n(root, profile),
    ...checkCicd(root),
  ];
  const summary = summarize(checks);
  return {
    generated_at: new Date().toISOString(),
    project_path: root,
    profile,
    overall: overallFrom(summary),
    checks,
    summary,
    exit_code: exitCodeFor(checks, summary, profile),
  };
}

export function doctorAndReport(
  projectRoot = process.cwd(),
  profile: DoctorProfile = "local",
) {
  const result = runDoctor(projectRoot, profile);
  printConsole(result);
  const reportPath = writeReport(projectRoot, result);
  console.log(`Report: ${reportPath}`);
  return result;
}
