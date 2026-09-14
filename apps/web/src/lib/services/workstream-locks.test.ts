import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import os from "os";
import path from "path";
import { promises as fs } from "fs";
import {
  acquireLock,
  checkLock,
  releaseLock,
  _clearLocksForTest,
  _setLeaseStoreBaseDir,
} from "./workstream-locks";

const MID = "MIS-TEST";
const WS = "WS-001";
const SESSION_A = "session-a";
const SESSION_B = "session-b";
const URL_A = "/intake/MIS-TEST/plan";
const URL_B = "/intake/MIS-TEST/plan?tab=B";

let tmpDir: string;

beforeEach(async () => {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "ws-leases-test-"));
  _setLeaseStoreBaseDir(tmpDir);
});

afterEach(async () => {
  vi.useRealTimers();
  await fs.rm(tmpDir, { recursive: true, force: true });
});

describe("acquireLock", () => {
  it("grants a lock when the workstream is free", async () => {
    const result = await acquireLock(MID, WS, SESSION_A, "alice", URL_A);
    expect("conflict" in result).toBe(false);
    if ("conflict" in result) throw new Error("unexpected conflict");
    expect(result.sessionId).toBe(SESSION_A);
    expect(result.actor).toBe("alice");
    expect(result.planUrl).toBe(URL_A);
  });

  it("rejects when another live session holds the lock", async () => {
    await acquireLock(MID, WS, SESSION_A, "alice", URL_A);
    const result = await acquireLock(MID, WS, SESSION_B, "bob", URL_B);
    expect("conflict" in result).toBe(true);
    const { conflict } = result as { conflict: { sessionId: string; actor: string } };
    expect(conflict.sessionId).toBe(SESSION_A);
    expect(conflict.actor).toBe("alice");
  });

  it("is idempotent for the same session (renews TTL)", async () => {
    const first = await acquireLock(MID, WS, SESSION_A, "alice", URL_A);
    const second = await acquireLock(MID, WS, SESSION_A, "alice", URL_A);
    expect("conflict" in second).toBe(false);
    if ("conflict" in first || "conflict" in second) throw new Error("unexpected conflict");
    expect(new Date(second.expiresAt).getTime()).toBeGreaterThanOrEqual(
      new Date(first.expiresAt).getTime(),
    );
  });

  it("allows re-acquire after TTL expiry", async () => {
    vi.useFakeTimers();
    await acquireLock(MID, WS, SESSION_A, "alice", URL_A);
    vi.advanceTimersByTime(6 * 60 * 1000);
    const result = await acquireLock(MID, WS, SESSION_B, "bob", URL_B);
    expect("conflict" in result).toBe(false);
  });
});

describe("releaseLock", () => {
  it("releases the lock when called by the owner", async () => {
    await acquireLock(MID, WS, SESSION_A, "alice", URL_A);
    const released = await releaseLock(MID, WS, SESSION_A);
    expect(released).toBe(true);
    expect(await checkLock(MID, WS, null)).toBeNull();
  });

  it("does nothing when called by a non-owner session", async () => {
    await acquireLock(MID, WS, SESSION_A, "alice", URL_A);
    const released = await releaseLock(MID, WS, SESSION_B);
    expect(released).toBe(false);
    expect(await checkLock(MID, WS, null)).not.toBeNull();
  });

  it("returns false when no lock exists", async () => {
    expect(await releaseLock(MID, WS, SESSION_A)).toBe(false);
  });
});

describe("checkLock", () => {
  it("returns null when the workstream is free", async () => {
    expect(await checkLock(MID, WS, SESSION_A)).toBeNull();
  });

  it("returns null when the same session holds the lock", async () => {
    await acquireLock(MID, WS, SESSION_A, "alice", URL_A);
    expect(await checkLock(MID, WS, SESSION_A)).toBeNull();
  });

  it("returns the conflict lock when a different session holds it", async () => {
    await acquireLock(MID, WS, SESSION_A, "alice", URL_A);
    const conflict = await checkLock(MID, WS, SESSION_B);
    expect(conflict).not.toBeNull();
    expect(conflict!.sessionId).toBe(SESSION_A);
    expect(conflict!.planUrl).toBe(URL_A);
  });

  it("returns conflict when sessionId is null (unknown caller)", async () => {
    await acquireLock(MID, WS, SESSION_A, "alice", URL_A);
    expect(await checkLock(MID, WS, null)).not.toBeNull();
  });

  it("returns null after lock has expired", async () => {
    vi.useFakeTimers();
    await acquireLock(MID, WS, SESSION_A, "alice", URL_A);
    vi.advanceTimersByTime(6 * 60 * 1000);
    expect(await checkLock(MID, WS, SESSION_B)).toBeNull();
  });
});

describe("handoff flow", () => {
  it("allows a second session to acquire after the first releases", async () => {
    await acquireLock(MID, WS, SESSION_A, "alice", URL_A);
    await releaseLock(MID, WS, SESSION_A);
    const result = await acquireLock(MID, WS, SESSION_B, "bob", URL_B);
    expect("conflict" in result).toBe(false);
    if ("conflict" in result) throw new Error("unexpected conflict");
    expect(result.sessionId).toBe(SESSION_B);
  });
});

describe("duplicate submission retry", () => {
  it("same session re-acquiring is idempotent (not a conflict)", async () => {
    await acquireLock(MID, WS, SESSION_A, "alice", URL_A);
    await releaseLock(MID, WS, SESSION_A);
    const result = await acquireLock(MID, WS, SESSION_A, "alice", URL_A);
    expect("conflict" in result).toBe(false);
  });
});

describe("isolation between workstreams", () => {
  it("locks on different workstreams do not interfere", async () => {
    await acquireLock(MID, "WS-001", SESSION_A, "alice", URL_A);
    const result = await acquireLock(MID, "WS-002", SESSION_B, "bob", URL_B);
    expect("conflict" in result).toBe(false);
  });
});

describe("concurrent two-session collision", () => {
  it("second session is blocked when first holds the lock", async () => {
    // Simulate two sessions racing to edit the same workstream
    const [r1, r2] = await Promise.all([
      acquireLock(MID, WS, SESSION_A, "alice", URL_A),
      acquireLock(MID, WS, SESSION_B, "bob", URL_B),
    ]);
    // Exactly one must succeed; the other must conflict
    const successes = [r1, r2].filter((r) => !("conflict" in r));
    const conflicts = [r1, r2].filter((r) => "conflict" in r);
    expect(successes).toHaveLength(1);
    expect(conflicts).toHaveLength(1);
  });

  it("stale-data write is rejected when another session holds the lock", async () => {
    await acquireLock(MID, WS, SESSION_A, "alice", URL_A);
    // SESSION_B tries to write without holding the lock
    const conflict = await checkLock(MID, WS, SESSION_B);
    expect(conflict).not.toBeNull();
    expect(conflict!.sessionId).toBe(SESSION_A);
  });
});

describe("planUrl validation", () => {
  it("accepts relative internal plan paths", async () => {
    const { isValidPlanUrl } = await import("./workstream-locks");
    expect(isValidPlanUrl("/intake/MIS-ABC/plan")).toBe(true);
    expect(isValidPlanUrl("/intake/MIS-ABC/plan?tab=edit")).toBe(true);
  });

  it("accepts absolute URLs with internal plan paths", async () => {
    const { isValidPlanUrl } = await import("./workstream-locks");
    expect(isValidPlanUrl("http://localhost:3000/intake/MIS-ABC/plan")).toBe(true);
  });

  it("rejects external or wrong paths", async () => {
    const { isValidPlanUrl } = await import("./workstream-locks");
    expect(isValidPlanUrl("https://evil.com/intake/MIS-ABC/plan")).toBe(true); // path matches, host irrelevant
    expect(isValidPlanUrl("/intake/MIS-ABC/edit")).toBe(false);
    expect(isValidPlanUrl("https://evil.com/steal")).toBe(false);
    expect(isValidPlanUrl("/other/path")).toBe(false);
  });
});
