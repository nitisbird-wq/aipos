import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import type { AuditCheck } from "../types";
import { fail, pass, warn } from "../types";

const IGNORE = new Set(["node_modules", ".git", ".next", "coverage", "dist"]);

function walkTests(root: string, acc: string[] = []): string[] {
  if (!existsSync(root)) return acc;
  for (const name of readdirSync(root)) {
    if (IGNORE.has(name)) continue;
    const full = path.join(root, name);
    let st;
    try {
      st = statSync(full);
    } catch {
      continue;
    }
    if (st.isDirectory()) walkTests(full, acc);
    else if (/\.(test|spec)\.(ts|tsx|js|jsx)$/.test(name)) acc.push(full);
  }
  return acc;
}

export function checkQuality(projectRoot: string): AuditCheck[] {
  const out: AuditCheck[] = [];
  const packagePath = path.join(projectRoot, "apps/web/package.json");
  const rootPackagePath = path.join(projectRoot, "package.json");

  if (!existsSync(packagePath)) {
    out.push(fail("Quality", "package.json", `ไม่พบ ${path.relative(projectRoot, packagePath)}`, "Critical"));
    return out;
  }

  try {
    const pkg = JSON.parse(readFileSync(packagePath, "utf8")) as {
      scripts?: Record<string, string>;
    };
    const scripts = pkg.scripts ?? {};
    const required = ["build", "lint", "test", "test:e2e"];
    for (const name of required) {
      if (scripts[name]) {
        out.push(pass("Quality", `npm script: ${name}`, `พบ script ${name}`));
      } else {
        out.push(fail("Quality", `npm script: ${name}`, `ไม่พบ script ${name}`, "High"));
      }
    }
    if (scripts["test:e2e-smoke"]) {
      out.push(pass("Quality", "npm script: test:e2e-smoke", "พบ script test:e2e-smoke"));
    } else {
      out.push(warn("Quality", "npm script: test:e2e-smoke", "ไม่พบ smoke e2e script", "Medium"));
    }
  } catch {
    out.push(fail("Quality", "package.json", "ไม่สามารถอ่าน apps/web/package.json ได้", "High"));
  }

  if (existsSync(rootPackagePath)) {
    try {
      const root = JSON.parse(readFileSync(rootPackagePath, "utf8")) as {
        scripts?: Record<string, string>;
      };
      if (root.scripts?.aipos || root.scripts?.doctor || root.scripts?.audit) {
        out.push(pass("Quality", "AIPOS CLI script", "พบ npm script สำหรับ aipos/doctor/audit"));
      } else {
        out.push(warn("Quality", "AIPOS CLI script", "ยังไม่มี npm run aipos/doctor", "Medium"));
      }
    } catch {
      /* ignore */
    }
  }

  const tests = walkTests(projectRoot);
  if (tests.length > 0) {
    out.push(pass("Quality", "Automated tests", `พบ test จำนวน ${tests.length} ไฟล์`));
  } else {
    out.push(fail("Quality", "Automated tests", "ไม่พบ automated test", "High"));
  }

  if (existsSync(path.join(projectRoot, "apps/web/tsconfig.json"))) {
    out.push(pass("Quality", "TypeScript config", "พบ apps/web/tsconfig.json"));
  } else {
    out.push(warn("Quality", "TypeScript config", "ไม่พบ tsconfig", "Medium"));
  }

  return out;
}
