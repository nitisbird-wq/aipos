import { afterEach, describe, expect, it } from "vitest";
import { mkdtempSync, rmSync, writeFileSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import { loadLocalEnvFile } from "./load-local-env";

const keys = ["LINEAR_ADAPTER", "LINEAR_API_KEY", "LINEAR_TEAM_ID"] as const;

afterEach(() => {
  for (const key of keys) delete process.env[key];
});

describe("standalone local env loader", () => {
  it("loads .env-style values without logging or changing existing environment values", () => {
    const dir = mkdtempSync(join(tmpdir(), "aipos-linear-env-"));
    const file = join(dir, ".env.local");
    writeFileSync(
      file,
      [
        "# local only",
        "LINEAR_ADAPTER=live",
        'LINEAR_API_KEY="lin_test_value"',
        "LINEAR_TEAM_ID=team_test",
      ].join("\n"),
      "utf8",
    );
    process.env.LINEAR_TEAM_ID = "existing_team";

    try {
      expect(loadLocalEnvFile(file)).toBe(true);
      expect(process.env.LINEAR_ADAPTER).toBe("live");
      expect(process.env.LINEAR_API_KEY).toBe("lin_test_value");
      expect(process.env.LINEAR_TEAM_ID).toBe("existing_team");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("returns false when the local env file does not exist", () => {
    expect(loadLocalEnvFile(join(tmpdir(), "aipos-missing-env-file"))).toBe(false);
  });
});
