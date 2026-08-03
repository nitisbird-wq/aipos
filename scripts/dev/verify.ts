/**
 * One-shot local verify: status snapshot + format + lint + unit tests + build + doctor.
 * Does not start docker or merge PRs.
 */
import { execSync } from "child_process";

function run(label: string, cmd: string) {
  console.log(`\n>>>> ${label}\n$ ${cmd}\n`);
  execSync(cmd, { stdio: "inherit" });
}

try {
  run("status", "npx tsx scripts/dev/status.ts");
  run("format:check", "npm run format:check");
  run("lint", "npm run lint");
  run("test", "npm test");
  run("build", "npm run build");
  run("doctor (pr)", "npm run aipos -- doctor --profile pr");
  console.log("\nverify: OK\n");
} catch {
  console.error("\nverify: FAILED\n");
  process.exit(1);
}
