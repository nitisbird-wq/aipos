import { existsSync, readdirSync } from "node:fs";
import path from "node:path";
import type { AuditCheck } from "../types";
import { fail, na, pass, warn } from "../types";

export function checkCicd(projectRoot: string): AuditCheck[] {
  const out: AuditCheck[] = [];
  const wfDir = path.join(projectRoot, ".github/workflows");

  if (existsSync(wfDir)) {
    const files = readdirSync(wfDir).filter((f) => f.endsWith(".yml") || f.endsWith(".yaml"));
    if (files.length > 0) {
      out.push(pass("CI/CD", "GitHub Actions", `พบ workflow CI จำนวน ${files.length} ไฟล์`));
    } else {
      out.push(fail("CI/CD", "GitHub Actions", "มีโฟลเดอร์ workflows แต่ยังไม่มีไฟล์", "High"));
    }
  } else {
    out.push(fail("CI/CD", "GitHub Actions", "ไม่พบ .github/workflows", "High"));
  }

  if (existsSync(path.join(projectRoot, ".github/pull_request_template.md"))) {
    out.push(pass("CI/CD", "Pull Request template", "พบ PR template"));
  } else {
    out.push(warn("CI/CD", "Pull Request template", "ไม่พบ PR template", "Medium"));
  }

  // Soft signal — cannot read GitHub branch protection from local without API
  out.push(
    na(
      "CI/CD",
      "Branch protection",
      "N/A จาก local/CI checkout — ตั้งค่าใน GitHub Settings หลังมี remote",
    ),
  );

  return out;
}
