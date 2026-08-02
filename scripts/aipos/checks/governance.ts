import { existsSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import type { AuditCheck } from "../types";
import { fail, pass, warn } from "../types";

type DocRequirement = {
  label: string;
  paths: string[]; // any one PASS
  severity: "High" | "Medium";
};

const REQUIRED: DocRequirement[] = [
  { label: "Project README", paths: ["README.md"], severity: "High" },
  { label: "Agent Instructions", paths: ["AGENTS.md"], severity: "High" },
  { label: "Environment example", paths: [".env.example"], severity: "High" },
  {
    label: "Mission",
    paths: ["docs/MISSION.md", "docs/AIPOS_MVP_SCOPE.md"],
    severity: "High",
  },
  {
    label: "Requirements",
    paths: ["docs/REQUIREMENTS.md", "docs/ACCEPTANCE_CRITERIA.md", "docs/API_CONTRACT.md"],
    severity: "High",
  },
  {
    label: "Architecture",
    paths: ["docs/ARCHITECTURE.md", "docs/AIPOS_ARCHITECTURE.md"],
    severity: "High",
  },
  {
    label: "Security",
    paths: ["docs/SECURITY.md", "docs/SECURITY_AND_PERMISSIONS.md"],
    severity: "High",
  },
  {
    label: "Acceptance Criteria",
    paths: ["docs/ACCEPTANCE_CRITERIA.md"],
    severity: "High",
  },
  {
    label: "Operations",
    paths: ["docs/OPERATIONS.md", "docs/DEPLOYMENT.md"],
    severity: "Medium",
  },
  {
    label: "Rollback Plan",
    paths: ["docs/ROLLBACK.md", "docs/RISK_REGISTER.md"],
    severity: "High",
  },
  {
    label: "Phase decisions / ADR binding",
    paths: ["docs/AIPOS_PHASE_1_DECISIONS.md"],
    severity: "Medium",
  },
];

function anyExists(root: string, rels: string[]): string | null {
  for (const rel of rels) {
    if (existsSync(path.join(root, rel))) return rel;
  }
  return null;
}

export function checkGovernance(projectRoot: string): AuditCheck[] {
  const out: AuditCheck[] = [];

  for (const req of REQUIRED) {
    const hit = anyExists(projectRoot, req.paths);
    if (hit) {
      out.push(pass("Governance", req.label, `พบไฟล์ ${hit}`));
    } else {
      out.push(
        fail(
          "Governance",
          req.label,
          `ไม่พบไฟล์ใดใน: ${req.paths.join(" | ")}`,
          req.severity,
        ),
      );
    }
  }

  if (existsSync(path.join(projectRoot, "CODEOWNERS")) ||
      existsSync(path.join(projectRoot, ".github/CODEOWNERS"))) {
    out.push(pass("Governance", "Code ownership", "พบ CODEOWNERS"));
  } else {
    out.push(warn("Governance", "Code ownership", "ไม่พบ CODEOWNERS", "Medium"));
  }

  const adrDir = path.join(projectRoot, "adr");
  if (existsSync(adrDir) && statSync(adrDir).isDirectory()) {
    const files = readdirSync(adrDir).filter((f) => !f.startsWith("."));
    if (files.length > 0) {
      out.push(
        pass("Governance", "Architecture Decision Records", `พบ ADR จำนวน ${files.length} ไฟล์`),
      );
    } else {
      out.push(
        warn(
          "Governance",
          "Architecture Decision Records",
          "มีโฟลเดอร์ ADR แต่ยังไม่มีเอกสาร",
          "Medium",
        ),
      );
    }
  } else {
    out.push(fail("Governance", "Architecture Decision Records", "ไม่พบโฟลเดอร์ ADR", "High"));
  }

  return out;
}
