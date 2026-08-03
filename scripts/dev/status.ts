/**
 * AIPOS Developer Control Center — status
 * Source of truth for PR merge state: `gh pr view --json` (never cached agent memory).
 */
import { execFileSync, execSync } from "child_process";
import { existsSync } from "fs";

type PrJson = {
  number: number;
  title: string;
  state: string;
  mergedAt: string | null;
  baseRefName: string;
  headRefName: string;
  url: string;
  mergeCommit?: { oid: string } | null;
  statusCheckRollup?: Array<{
    name: string;
    status: string;
    conclusion?: string | null;
  }>;
};

const DEPENDENCY_ORDER: Array<{
  id: string;
  title: string;
  pr?: number;
  dependsOn: string[];
}> = [
  { id: "A", title: "Phase 2 Runtime Hardening", pr: 10, dependsOn: ["#8"] },
  {
    id: "B",
    title: "Phase 3a Planning Foundation",
    dependsOn: ["#8", "#9", "#10→main"],
  },
  { id: "C", title: "Phase 3b Subtask Engine", dependsOn: ["B"] },
  { id: "D", title: "Phase 3c Assignment Engine", dependsOn: ["C"] },
  { id: "E", title: "Phase 4 ADR n8n Execution", dependsOn: ["D"] },
  { id: "F", title: "Phase 4 n8n Execution Adapter", dependsOn: ["E"] },
  { id: "G", title: "Phase 5 Artifact + Review", dependsOn: ["F"] },
  { id: "H", title: "Phase 6 Closeout", dependsOn: ["G"] },
  { id: "I", title: "Operations Monitoring", dependsOn: ["H"] },
  { id: "J", title: "Full-Cycle E2E", dependsOn: ["I"] },
];

function sh(cmd: string): string {
  try {
    return execSync(cmd, {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    }).trim();
  } catch (err) {
    const e = err as { stdout?: string; stderr?: string; message?: string };
    return (e.stdout || e.stderr || e.message || "").toString().trim();
  }
}

function tryExecFile(
  bin: string,
  args: string[],
): { ok: boolean; out: string } {
  try {
    const out = execFileSync(bin, args, {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    });
    return { ok: true, out: out.trim() };
  } catch (err) {
    const e = err as { stdout?: string; stderr?: string; message?: string };
    return {
      ok: false,
      out: (e.stdout || e.stderr || e.message || "").toString().trim(),
    };
  }
}

function section(title: string) {
  console.log(`\n=== ${title} ===`);
}

function ghAvailable(): boolean {
  const r = tryExecFile("gh", ["--version"]);
  return r.ok;
}

function windowsGhInstallHelp() {
  console.log(`
GitHub CLI (gh) is required for PR/CI status (source of truth).

Windows install options (do this yourself — this script will not install):
  1. winget:  winget install --id GitHub.cli
  2. scoop:   scoop install gh
  3. MSI:     https://cli.github.com/
Then: gh auth login
`);
}

function tcpHealth(host: string, port: number, timeoutMs = 1500): boolean {
  try {
    // Node net via bash-free approach using powershell/bash nc if present is messy;
    // use a tiny node script inline via sync spawn of node -e
    const code = `
      const net=require('net');
      const s=net.connect({host:'${host}',port:${port}});
      const t=setTimeout(()=>{s.destroy();process.exit(1)}, ${timeoutMs});
      s.on('connect',()=>{clearTimeout(t);s.end();process.exit(0)});
      s.on('error',()=>{clearTimeout(t);process.exit(1)});
    `;
    execFileSync(process.execPath, ["-e", code], { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

function httpHealth(url: string, timeoutMs = 2000): boolean {
  try {
    const code = `
      const u=new URL(${JSON.stringify(url)});
      const lib=u.protocol==='https:'?require('https'):require('http');
      const req=lib.get(u,res=>{res.resume();process.exit(res.statusCode&&res.statusCode<500?0:1)});
      req.setTimeout(${timeoutMs},()=>{req.destroy();process.exit(1)});
      req.on('error',()=>process.exit(1));
    `;
    execFileSync(process.execPath, ["-e", code], { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

function main() {
  console.log("AIPOS Developer Control Center — status");
  console.log(`Time: ${new Date().toISOString()}`);

  section("Git");
  const branch = sh("git branch --show-current") || "(detached)";
  const dirty = sh("git status --short") || "(clean)";
  sh("git fetch origin main --quiet");
  const mainSha = sh("git rev-parse origin/main");
  const mainSubject = sh("git log -1 --oneline origin/main");
  console.log(`current branch: ${branch}`);
  console.log(`dirty files:\n${dirty}`);
  console.log(`origin/main: ${mainSha}`);
  console.log(`origin/main tip: ${mainSubject}`);

  section("GitHub CLI");
  if (!ghAvailable()) {
    console.log("gh: NOT AVAILABLE");
    windowsGhInstallHelp();
  } else {
    const ver = tryExecFile("gh", ["--version"]).out.split("\n")[0];
    console.log(`gh: ${ver}`);
    const auth = tryExecFile("gh", ["auth", "status"]);
    console.log(
      auth.ok
        ? "gh auth: ok"
        : `gh auth: ${auth.out.split("\n")[0] || "not logged in"}`,
    );
  }

  section("Open PRs (gh pr list --json)");
  if (ghAvailable()) {
    const list = tryExecFile("gh", [
      "pr",
      "list",
      "--state",
      "open",
      "--json",
      "number,title,headRefName,baseRefName,url",
    ]);
    if (list.ok) {
      const prs = JSON.parse(list.out || "[]") as Array<{
        number: number;
        title: string;
        headRefName: string;
        baseRefName: string;
        url: string;
      }>;
      if (prs.length === 0) console.log("(no open PRs)");
      for (const p of prs) {
        console.log(
          `#${p.number} [${p.baseRefName}←${p.headRefName}] ${p.title}`,
        );
        console.log(`  ${p.url}`);
      }
    } else {
      console.log(`failed: ${list.out}`);
    }
  } else {
    console.log("skipped (gh missing)");
  }

  section("Tracked PRs — mergedAt / base (gh pr view --json SoT)");
  const tracked = [8, 9, 10];
  if (ghAvailable()) {
    for (const n of tracked) {
      const r = tryExecFile("gh", [
        "pr",
        "view",
        String(n),
        "--json",
        "number,title,state,mergedAt,baseRefName,headRefName,url,mergeCommit,statusCheckRollup",
      ]);
      if (!r.ok) {
        console.log(`#${n}: error ${r.out}`);
        continue;
      }
      const pr = JSON.parse(r.out) as PrJson;
      const mergeOid = pr.mergeCommit?.oid?.slice(0, 7) || "—";
      console.log(
        `#${pr.number} state=${pr.state} mergedAt=${pr.mergedAt ?? "null"} base=${pr.baseRefName} merge=${mergeOid}`,
      );
      console.log(`  ${pr.title}`);
      // Is merge commit on origin/main?
      if (pr.mergeCommit?.oid) {
        const onMain = tryExecFile("git", [
          "merge-base",
          "--is-ancestor",
          pr.mergeCommit.oid,
          "origin/main",
        ]);
        console.log(
          `  on origin/main: ${onMain.ok ? "YES" : "NO (merged into another base or not fetched)"}`,
        );
      }
      const checks = pr.statusCheckRollup || [];
      if (checks.length) {
        for (const c of checks) {
          console.log(
            `  CI: ${c.name} status=${c.status} conclusion=${c.conclusion ?? "—"}`,
          );
        }
      }
    }
  } else {
    console.log("skipped (gh missing)");
  }

  section("Long-Run dependency order");
  for (const d of DEPENDENCY_ORDER) {
    const pr = d.pr ? ` PR#${d.pr}` : "";
    console.log(
      `${d.id}${pr}: ${d.title}  (depends: ${d.dependsOn.join(", ")})`,
    );
  }
  console.log(
    "Note: #10 must land on main (not only feat/postgres-runtime-adapter) before PR B implementation from main.",
  );

  section("Docker");
  const docker = tryExecFile("docker", ["info", "-f", "{{.ServerVersion}}"]);
  if (!docker.ok) {
    console.log(
      "docker: NOT AVAILABLE (install Docker Desktop on Windows to use services:up)",
    );
  } else {
    console.log(`docker engine: ${docker.out || "ok"}`);
    const composeFile = existsSync("docker-compose.yml")
      ? "docker-compose.yml"
      : "docker-compose.postgres.yml";
    const ps = tryExecFile("docker", [
      "compose",
      "-f",
      composeFile,
      "ps",
      "--format",
      "json",
    ]);
    if (ps.ok && ps.out) {
      console.log(`compose (${composeFile}):`);
      console.log(ps.out);
    } else {
      const ps2 = tryExecFile("docker", ["compose", "-f", composeFile, "ps"]);
      console.log(ps2.out || "(no services running)");
    }
  }

  section("PostgreSQL health");
  const pgOk = tcpHealth("127.0.0.1", 5432);
  console.log(`tcp 127.0.0.1:5432 → ${pgOk ? "UP" : "DOWN"}`);
  if (pgOk) {
    // optional pg_isready inside compose
    const ready = tryExecFile("docker", [
      "compose",
      "-f",
      existsSync("docker-compose.yml")
        ? "docker-compose.yml"
        : "docker-compose.postgres.yml",
      "exec",
      "-T",
      "postgres",
      "pg_isready",
      "-U",
      "aipos",
      "-d",
      "aipos",
    ]);
    console.log(
      ready.ok
        ? `pg_isready: ${ready.out}`
        : "pg_isready: skipped (container exec failed)",
    );
  }

  section("n8n health");
  const n8nOk =
    httpHealth("http://127.0.0.1:5678/healthz") ||
    httpHealth("http://127.0.0.1:5678/");
  console.log(`http://127.0.0.1:5678 → ${n8nOk ? "UP" : "DOWN"}`);

  section("App (Next.js) probe");
  const appOk = httpHealth("http://127.0.0.1:3000/login");
  console.log(`http://127.0.0.1:3000/login → ${appOk ? "UP" : "DOWN"}`);

  console.log(
    "\nDone. PR merge truth comes only from `gh pr view --json`, not agent memory.\n",
  );
}

main();
