/**
 * AIPOS local services up/down via docker compose.
 * Dev placeholders only — never production credentials.
 */
import { execFileSync } from "child_process";
import { existsSync } from "fs";

const action = process.argv[2] === "down" ? "down" : "up";
const composeFile = existsSync("docker-compose.yml")
  ? "docker-compose.yml"
  : "docker-compose.postgres.yml";

function run(bin: string, args: string[]) {
  execFileSync(bin, args, { stdio: "inherit" });
}

try {
  execFileSync("docker", ["info"], { stdio: "ignore" });
} catch {
  console.error(`
Docker is not available.

Windows: install Docker Desktop, then re-run:
  npm run services:up

This script will not install Docker for you.
`);
  process.exit(1);
}

if (action === "up") {
  console.log(
    `Starting local stack (${composeFile}) — postgres + n8n (dev only)...`,
  );
  run("docker", ["compose", "-f", composeFile, "up", "-d", "--wait"]);
  console.log(`
Services requested.
  Postgres: postgresql://aipos:aipos_dev_only@localhost:5432/aipos
  n8n UI:   http://localhost:5678
Next:
  DATABASE_URL=postgresql://aipos:aipos_dev_only@localhost:5432/aipos npm run db:migrate -w web
  npm run status
`);
} else {
  console.log(`Stopping local stack (${composeFile})...`);
  run("docker", ["compose", "-f", composeFile, "down"]);
  console.log(
    "Stopped. Volumes kept (data persists). Use docker compose down -v to wipe.",
  );
}
