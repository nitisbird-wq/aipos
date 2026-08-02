import { execFileSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import type { AuditCheck } from "../types";
import { fail, pass, warn } from "../types";

const IGNORE_DIRS = new Set([
  "node_modules",
  ".git",
  ".next",
  "coverage",
  "dist",
  ".data",
  ".data-test",
  "playwright-report",
  "test-results",
]);

const SECRET_RE =
  /(api[_-]?key|secret|access[_-]?token|private[_-]?key|password)\s*[:=]\s*["']([^"']{6,})["']/gi;

const PLACEHOLDER_SECRET_RE =
  /^(dev[-_]?password|password|changeme|example|xxx+|todo|replace[-_]?me|your[-_].+|test[-_]?secret)$/i;

function shouldSkipSecretScan(file: string): boolean {
  const base = path.basename(file);
  const norm = file.replace(/\\/g, "/");
  if (base === ".env.example") return true;
  if (base.endsWith(".local")) return true;
  if (/\.(test|spec)\.(ts|tsx|js|jsx)$/.test(base)) return true;
  if (/\/scripts\/e2e[^/]*\.(ts|js)$/i.test(norm)) return true;
  return false;
}

const SENSITIVE_TRACKED_RE =
  /(^|\/)(\.env|\.env\.local|\.env\.production|\.pem|\.key|\.pfx|\.sqlite3?|\.db)$/i;

function git(cwd: string, args: string[]): string {
  try {
    return execFileSync("git", args, {
      cwd,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    }).trim();
  } catch {
    return "";
  }
}

function walkFiles(root: string, acc: string[] = []): string[] {
  if (!existsSync(root)) return acc;
  for (const name of readdirSync(root)) {
    if (IGNORE_DIRS.has(name)) continue;
    const full = path.join(root, name);
    let st;
    try {
      st = statSync(full);
    } catch {
      continue;
    }
    if (st.isDirectory()) walkFiles(full, acc);
    else acc.push(full);
  }
  return acc;
}

function isIgnored(projectRoot: string, relativePath: string): boolean {
  try {
    execFileSync("git", ["check-ignore", "-q", "--", relativePath], {
      cwd: projectRoot,
      stdio: "ignore",
    });
    return true;
  } catch {
    return false;
  }
}

export function checkSecurity(projectRoot: string): AuditCheck[] {
  const out: AuditCheck[] = [];

  const tracked = git(projectRoot, ["ls-files"]).split("\n").filter(Boolean);
  const sensitiveTracked = tracked.filter((f) => SENSITIVE_TRACKED_RE.test(f));
  if (sensitiveTracked.length === 0) {
    out.push(
      pass(
        "Security",
        "Sensitive tracked files",
        "ไม่พบไฟล์ลับหรือฐานข้อมูลที่ถูก Git track",
      ),
    );
  } else {
    out.push(
      fail(
        "Security",
        "Sensitive tracked files",
        `พบไฟล์เสี่ยง: ${sensitiveTracked.join(", ")}`,
        "Critical",
      ),
    );
  }

  // Local env files must be ignored
  const envCandidates = walkFiles(projectRoot).filter((f) => {
    const base = path.basename(f);
    return (
      base === ".env" ||
      base === ".env.local" ||
      /^\.env\..+\.local$/.test(base) ||
      base === ".env.production"
    );
  });

  if (envCandidates.length === 0) {
    out.push(
      pass(
        "Security",
        "Environment files present",
        "ไม่พบ .env / .env.local ใน working tree (หรือยังไม่ได้สร้าง)",
      ),
    );
  }

  for (const abs of envCandidates) {
    const rel = path.relative(projectRoot, abs).replace(/\\/g, "/");
    if (isIgnored(projectRoot, rel)) {
      out.push(pass("Security", "Environment file ignored", `${rel} ถูก ignore`));
    } else {
      out.push(
        fail("Security", "Environment file ignored", `${rel} ยังไม่ถูก ignore`, "Critical"),
      );
    }
  }

  // Secret pattern scan — report file:line only, never secret values
  const scanExts = new Set([
    ".ts",
    ".tsx",
    ".js",
    ".jsx",
    ".json",
    ".md",
    ".yml",
    ".yaml",
    ".txt",
    ".sql",
    ".env",
  ]);
  const hits: string[] = [];
  for (const file of walkFiles(projectRoot)) {
    const ext = path.extname(file).toLowerCase();
    const base = path.basename(file);
    if (!scanExts.has(ext) && !base.startsWith(".env")) continue;
    if (shouldSkipSecretScan(file)) continue;
    let content = "";
    try {
      content = readFileSync(file, "utf8");
    } catch {
      continue;
    }
    const lines = content.split(/\r?\n/);
    lines.forEach((line, idx) => {
      SECRET_RE.lastIndex = 0;
      let m: RegExpExecArray | null;
      while ((m = SECRET_RE.exec(line)) !== null) {
        const value = m[2] ?? "";
        if (PLACEHOLDER_SECRET_RE.test(value)) continue;
        const rel = path.relative(projectRoot, file).replace(/\\/g, "/");
        hits.push(`${rel}:${idx + 1}`);
      }
    });
  }

  if (hits.length === 0) {
    out.push(pass("Security", "Secret pattern scan", "ไม่พบรูปแบบ secret ที่ชัดเจน"));
  } else {
    out.push(
      fail(
        "Security",
        "Secret pattern scan",
        `พบตำแหน่งที่ควรตรวจ: ${hits.slice(0, 20).join(", ")}${hits.length > 20 ? " …" : ""}`,
        "Critical",
      ),
    );
  }

  // Runtime data / sqlite should not be tracked
  const runtimeTracked = tracked.filter(
    (f) =>
      f.includes(".data/") ||
      f.endsWith(".sqlite") ||
      f.endsWith(".sqlite3") ||
      f.endsWith(".db") ||
      f.endsWith(".log"),
  );
  if (runtimeTracked.length === 0) {
    out.push(pass("Security", "Runtime artifacts tracked", "ไม่พบ data/db/log ที่ถูก track"));
  } else {
    out.push(
      fail(
        "Security",
        "Runtime artifacts tracked",
        `พบ: ${runtimeTracked.join(", ")}`,
        "High",
      ),
    );
  }

  if (!existsSync(path.join(projectRoot, ".gitignore"))) {
    out.push(fail("Security", "Git ignore policy", "ไม่พบ .gitignore", "High"));
  } else {
    out.push(pass("Security", "Git ignore policy", "พบ .gitignore"));
  }

  return out;
}
