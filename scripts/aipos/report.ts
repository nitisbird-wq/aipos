import { writeFileSync } from "node:fs";
import path from "node:path";
import type { AuditResult } from "./types";

export function renderMarkdown(result: AuditResult): string {
  const decision =
    result.overall === "NOT READY"
      ? "ไม่ควร Commit หรือ Deploy จนกว่าจะแก้ Critical Finding"
      : result.overall === "REQUIRES ACTION"
        ? "สามารถพัฒนาต่อได้ แต่ควรแก้ High Finding ก่อน Production"
        : result.overall === "CONDITIONALLY READY"
          ? "พร้อมใช้งานแบบมีเงื่อนไข ควรแก้ Warning ตามลำดับ"
          : "ผ่านการตรวจพื้นฐาน";

  const rows = result.checks
    .map((c) => {
      const detail = c.detail.replace(/\|/g, "\\|");
      return `| ${c.category} | ${c.name} | ${c.status} | ${c.severity} | ${detail} |`;
    })
    .join("\n");

  return `# AIPOS Project Audit Report

**Generated:** ${result.generated_at}  
**Project:** ${result.project_path}  
**Profile:** ${result.profile}  
**Overall Status:** ${result.overall}  
**Exit code:** ${result.exit_code}

## Summary

| Metric | Count |
|---|---:|
| Passed | ${result.summary.pass} |
| Failed | ${result.summary.fail} |
| Warnings | ${result.summary.warn} |
| N/A | ${result.summary.na} |
| Critical | ${result.summary.critical} |
| High | ${result.summary.high} |
| Medium | ${result.summary.medium} |

## Findings

| Category | Check | Status | Severity | Detail |
|---|---|---|---|---|
${rows}

## Decision

${decision}
`;
}

export function writeReport(
  projectRoot: string,
  result: AuditResult,
  filename = "AIPOS_AUDIT_REPORT.md",
) {
  const outPath = path.join(projectRoot, filename);
  writeFileSync(outPath, renderMarkdown(result), "utf8");
  return outPath;
}

export function printConsole(result: AuditResult) {
  const icon = (status: string) =>
    status === "PASS"
      ? "✓"
      : status === "FAIL"
        ? "✗"
        : status === "WARN"
          ? "!"
          : status === "NA"
            ? "·"
            : "·";

  console.log("");
  console.log("AIPOS Doctor v1.1");
  console.log(`Project: ${result.project_path}`);
  console.log(`Profile: ${result.profile}`);
  console.log("");

  let lastCat = "";
  for (const c of result.checks) {
    if (c.category !== lastCat) {
      console.log(c.category);
      lastCat = c.category;
    }
    console.log(`${icon(c.status)} ${c.name}`);
    if (c.status !== "PASS") {
      console.log(`  ${c.detail}`);
    }
  }

  console.log("");
  console.log(
    `Summary: pass=${result.summary.pass} fail=${result.summary.fail} warn=${result.summary.warn} na=${result.summary.na} critical=${result.summary.critical} high=${result.summary.high}`,
  );
  console.log(`Overall: ${result.overall}`);
  console.log(`Exit: ${result.exit_code}`);
  console.log("");
}
