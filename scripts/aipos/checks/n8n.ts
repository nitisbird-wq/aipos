import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import type { AuditCheck, DoctorProfile } from "../types";
import { fail, na, pass, warn } from "../types";

function listJson(dir: string): string[] {
  if (!existsSync(dir)) return [];
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const full = path.join(dir, name);
    const st = statSync(full);
    if (st.isDirectory()) out.push(...listJson(full));
    else if (name.endsWith(".json")) out.push(full);
  }
  return out;
}

/**
 * n8n is planned for later execution phases.
 * Missing workflows → NA (not WARN) unless production profile forces readiness.
 */
export function checkN8n(
  projectRoot: string,
  profile: DoctorProfile = "local",
): AuditCheck[] {
  const out: AuditCheck[] = [];
  const wfDir = path.join(projectRoot, "n8n/workflows");
  const files = listJson(wfDir);

  if (files.length > 0) {
    out.push(pass("n8n", "Workflow exports", `พบ n8n workflow จำนวน ${files.length} ไฟล์`));

    let hardCred = 0;
    let missingError = 0;
    for (const file of files) {
      const raw = readFileSync(file, "utf8");
      if (/"apiKey"\s*:\s*"[^"]+"|"password"\s*:\s*"[^"]+"|"token"\s*:\s*"[^"]+"/i.test(raw)) {
        hardCred += 1;
      }
      if (!/error|onError|continueOnFail/i.test(raw)) {
        missingError += 1;
      }
    }
    if (hardCred === 0) {
      out.push(
        pass(
          "n8n",
          "Hardcoded credentials",
          "ไม่พบ credential hardcode ชัดเจนใน workflow export",
        ),
      );
    } else {
      out.push(
        fail(
          "n8n",
          "Hardcoded credentials",
          `พบ workflow ที่อาจ hardcode credential: ${hardCred} ไฟล์`,
          "Critical",
        ),
      );
    }
    if (missingError === 0) {
      out.push(pass("n8n", "Error path signals", "พบสัญญาณ error handling ใน workflow exports"));
    } else {
      out.push(
        warn(
          "n8n",
          "Error path signals",
          `${missingError}/${files.length} ไฟล์ไม่พบคำว่า error/onError/continueOnFail`,
          "Medium",
        ),
      );
    }

    if (existsSync(path.join(projectRoot, "n8n/environment-map.md"))) {
      out.push(pass("n8n", "Environment mapping", "พบ environment mapping"));
    } else {
      out.push(warn("n8n", "Environment mapping", "ไม่พบ n8n/environment-map.md", "Medium"));
    }
  } else if (profile === "production") {
    out.push(
      warn(
        "n8n",
        "Workflow exports",
        "Production profile: ยังไม่มี n8n workflow — ตั้งเป็น PLANNED หรือเพิ่ม export ก่อน claim execution readiness",
        "Medium",
      ),
    );
    out.push(
      na(
        "n8n",
        "Environment mapping",
        "N/A จนกว่าจะมี n8n/workflows (PLANNED สำหรับ Mission Intake MVP)",
      ),
    );
  } else {
    out.push(
      na(
        "n8n",
        "Workflow exports",
        "N/A — n8n ยังไม่ใช่ขอบเขต Mission Intake MVP (PLANNED)",
      ),
    );
    out.push(
      na(
        "n8n",
        "Environment mapping",
        "N/A — จะเพิ่ม n8n/environment-map.md เมื่อมี workflow จริง",
      ),
    );
  }

  return out;
}
