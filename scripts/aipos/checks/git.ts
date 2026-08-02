import { execFileSync } from "node:child_process";
import type { AuditCheck } from "../types";
import { fail, pass, warn } from "../types";

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

export function checkGit(projectRoot: string): AuditCheck[] {
  const out: AuditCheck[] = [];
  const inside = git(projectRoot, ["rev-parse", "--is-inside-work-tree"]);

  if (inside !== "true") {
    out.push(fail("Git", "Git repository", "โฟลเดอร์นี้ยังไม่เป็น Git repository", "Critical"));
    return out;
  }
  out.push(pass("Git", "Git repository", "โฟลเดอร์นี้เป็น Git repository"));

  const branch = git(projectRoot, ["branch", "--show-current"]);
  if (!branch) {
    out.push(
      warn("Git", "Current branch", "ยังไม่มี commit แรก หรืออ่าน branch ไม่ได้", "High"),
    );
  } else if (branch === "main" || branch === "master") {
    out.push(pass("Git", "Current branch", `กำลังใช้งาน branch ${branch}`));
    if (branch === "master") {
      out.push(
        warn(
          "Git",
          "Branch naming",
          "ใช้ master — แนะนำเปลี่ยนเป็น main สำหรับมาตรฐานทีม",
          "Medium",
        ),
      );
    }
  } else {
    out.push(warn("Git", "Current branch", `กำลังใช้งาน branch ${branch} แทน main`, "Medium"));
  }

  const countText = git(projectRoot, ["rev-list", "--count", "HEAD"]);
  const count = Number.parseInt(countText, 10);
  if (Number.isFinite(count) && count > 0) {
    out.push(pass("Git", "Commit history", `พบ commit จำนวน ${count} รายการ`));
  } else {
    out.push(fail("Git", "Commit history", "ยังไม่มี commit แรก", "High"));
  }

  const remote = git(projectRoot, ["remote", "-v"]);
  if (remote) {
    out.push(pass("Git", "Git remote", "เชื่อม remote แล้ว"));
  } else {
    out.push(fail("Git", "Git remote", "ยังไม่ได้เชื่อม GitHub หรือ Git remote", "High"));
  }

  const porcelain = git(projectRoot, ["status", "--porcelain"]);
  const changeCount = porcelain ? porcelain.split("\n").filter(Boolean).length : 0;
  if (changeCount === 0) {
    out.push(pass("Git", "Working tree", "ไม่มีไฟล์ค้าง"));
  } else if (changeCount <= 20) {
    out.push(warn("Git", "Working tree", `พบไฟล์เปลี่ยนแปลง ${changeCount} รายการ`, "Medium"));
  } else {
    out.push(
      fail(
        "Git",
        "Working tree",
        `พบไฟล์เปลี่ยนแปลง ${changeCount} รายการ ควรแบ่ง commit หรือ PR`,
        "High",
      ),
    );
  }

  if (remote) {
    const unpushed = git(projectRoot, ["rev-list", "--count", "@{u}..HEAD"]);
    const n = Number.parseInt(unpushed, 10);
    if (Number.isFinite(n) && n > 0) {
      out.push(warn("Git", "Unpushed commits", `มี commit ที่ยังไม่ได้ push: ${n}`, "Medium"));
    } else {
      out.push(
        pass(
          "Git",
          "Unpushed commits",
          "ไม่มี commit ค้างที่ยังไม่ push (หรือยังไม่มี upstream)",
        ),
      );
    }
  }

  return out;
}
