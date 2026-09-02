import { preflightLiveLinearConnection } from "../src/lib/linear/client";
import { loadLocalEnvFile } from "./load-local-env";

loadLocalEnvFile();

async function main(): Promise<void> {
  const mode = (process.env.LINEAR_ADAPTER ?? "").trim().toLowerCase();
  const apiKey = process.env.LINEAR_API_KEY?.trim();
  const teamId = process.env.LINEAR_TEAM_ID?.trim();

  if (mode !== "live") {
    throw new Error("LINEAR_ADAPTER must be set to live");
  }
  if (!apiKey || !teamId) {
    throw new Error("LINEAR_API_KEY and LINEAR_TEAM_ID are required");
  }

  const result = await preflightLiveLinearConnection({ apiKey, teamId });
  console.log(
    JSON.stringify(
      {
        ok: true,
        adapter: "live",
        authenticated: result.authenticated,
        team: result.team,
        write_performed: result.write_performed,
      },
      null,
      2,
    ),
  );
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : "unknown error";
  console.error(`Linear read-only preflight failed: ${message}`);
  process.exitCode = 1;
});
