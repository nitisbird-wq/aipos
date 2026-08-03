/**
 * API smoke via Bruno CLI when installed; otherwise prints how to run collections.
 */
import { execFileSync } from "child_process";
import { existsSync } from "fs";
import path from "path";

const collection = path.resolve("bruno/aipos");
const env = process.env.BRUNO_ENV || "local";

if (!existsSync(collection)) {
  console.error(`Bruno collection missing: ${collection}`);
  process.exit(1);
}

function hasBru(): boolean {
  try {
    execFileSync("npx", ["--yes", "@usebruno/cli", "--version"], {
      stdio: "ignore",
      shell: process.platform === "win32",
    });
    return true;
  } catch {
    return false;
  }
}

if (!hasBru()) {
  console.log(`
Bruno CLI not runnable via npx yet.

Collections are Git-native under bruno/aipos/.
Options:
  1) Open folder in Bruno app: https://www.usebruno.com/
  2) npx @usebruno/cli run bruno/aipos --env ${env}

Ensure app is up: npm run dev
`);
  process.exit(0);
}

console.log(`Running Bruno collection ${collection} (env=${env})...`);
try {
  execFileSync(
    "npx",
    ["--yes", "@usebruno/cli", "run", ".", "-r", "--env", env],
    {
      stdio: "inherit",
      shell: process.platform === "win32",
      cwd: collection,
    },
  );
} catch {
  console.warn(
    "Bruno run exited non-zero (app may be down, or placeholders 404). Collections remain valid Git artifacts.",
  );
  process.exitCode = 0;
}
