import { afterEach, describe, expect, it, vi } from "vitest";
import {
  acquireLock,
  checkLock,
  releaseLock,
  _clearLocksForTest,
} from "./workstream-locks";

const MID = "MIS-TEST";
const WS = "WS-001";
const SESSION_A = "session-a";
const SESSION_B = "session-b";
const URL_A = "http://localhost:3000/intake/MIS-TEST/plan?tab=A";
const URL_B = "http://localhost:3000/intake/MIS-TEST/plan?tab=B";

afterEach(() => {
  _clearLocksForTest();
  vi.useRealTimers();
});

describe("acquireLock", () => {
  it("grants a lock when the workstream is free", () => {
    const result = acquireLock(MID, WS, SESSION_A, "alice", URL_A);
    expect("conflict" in result).toBe(false);
    if ("conflict" in result) throw new Error("unexpected conflict");
    expect(result.sessionId).toBe(SESSION_A);
    expect(result.actor).toBe("alice");
    expect(result.planUrl).toBe(URL_A);
  });

  it("rejects when another live session holds the lock", () => {
    acquireLock(MID, WS, SESSION_A, "alice", URL_A);
    const result = acquireLock(MID, WS, SESSION_B, "bob", URL_B);
    expect("conflict" in result).toBe(true);
    const { conflict } = result as { conflict: { sessionId: string; actor: string } };
    expect(conflict.sessionId).toBe(SESSION_A);
    expect(conflict.actor).toBe("alice");
  });

  it("is idempotent for the same session (renews TTL)", () => {
    const first = acquireLock(MID, WS, SESSION_A, "alice", URL_A);
    const second = acquireLock(MID, WS, SESSION_A, "alice", URL_A);
    expect("conflict" in second).toBe(false);
    if ("conflict" in first || "conflict" in second) throw new Error("unexpected conflict");
    expect(new Date(second.expiresAt).getTime()).toBeGreaterThanOrEqual(
      new Date(first.expiresAt).getTime(),
    );
  });

  it("allows re-acquire after TTL expiry", () => {
    vi.useFakeTimers();
    acquireLock(MID, WS, SESSION_A, "alice", URL_A);
    vi.advanceTimersByTime(6 * 60 * 1000); // 6 minutes
    const result = acquireLock(MID, WS, SESSION_B, "bob", URL_B);
    expect("conflict" in result).toBe(false);
  });
});

describe("releaseLock", () => {
  it("releases the lock when called by the owner", () => {
    acquireLock(MID, WS, SESSION_A, "alice", URL_A);
    const released = releaseLock(MID, WS, SESSION_A);
    expect(released).toBe(true);
    expect(checkLock(MID, WS, null)).toBeNull();
  });

  it("does nothing when called by a non-owner session", () => {
    acquireLock(MID, WS, SESSION_A, "alice", URL_A);
    const released = releaseLock(MID, WS, SESSION_B);
    expect(released).toBe(false);
    expect(checkLock(MID, WS, null)).not.toBeNull();
  });

  it("returns false when no lock exists", () => {
    expect(releaseLock(MID, WS, SESSION_A)).toBe(false);
  });
});

describe("checkLock", () => {
  it("returns null when the workstream is free", () => {
    expect(checkLock(MID, WS, SESSION_A)).toBeNull();
  });

  it("returns null when the same session holds the lock", () => {
    acquireLock(MID, WS, SESSION_A, "alice", URL_A);
    expect(checkLock(MID, WS, SESSION_A)).toBeNull();
  });

  it("returns the conflict lock when a different session holds it", () => {
    acquireLock(MID, WS, SESSION_A, "alice", URL_A);
    const conflict = checkLock(MID, WS, SESSION_B);
    expect(conflict).not.toBeNull();
    expect(conflict!.sessionId).toBe(SESSION_A);
    expect(conflict!.planUrl).toBe(URL_A);
  });

  it("returns conflict when sessionId is null (unknown caller)", () => {
    acquireLock(MID, WS, SESSION_A, "alice", URL_A);
    expect(checkLock(MID, WS, null)).not.toBeNull();
  });

  it("returns null after lock has expired", () => {
    vi.useFakeTimers();
    acquireLock(MID, WS, SESSION_A, "alice", URL_A);
    vi.advanceTimersByTime(6 * 60 * 1000);
    expect(checkLock(MID, WS, SESSION_B)).toBeNull();
  });
});

describe("handoff flow", () => {
  it("allows a second session to acquire after the first releases", () => {
    acquireLock(MID, WS, SESSION_A, "alice", URL_A);
    releaseLock(MID, WS, SESSION_A);
    const result = acquireLock(MID, WS, SESSION_B, "bob", URL_B);
    expect("conflict" in result).toBe(false);
    const lock = result as { sessionId: string };
    expect(lock.sessionId).toBe(SESSION_B);
  });
});

describe("duplicate submission retry", () => {
  it("same session re-acquiring is idempotent (not a conflict)", () => {
    acquireLock(MID, WS, SESSION_A, "alice", URL_A);
    // First PATCH goes through and releases the lock
    releaseLock(MID, WS, SESSION_A);
    // Session A retries (e.g. network error) — re-acquires and no conflict
    const result = acquireLock(MID, WS, SESSION_A, "alice", URL_A);
    expect("conflict" in result).toBe(false);
  });
});

describe("isolation between workstreams", () => {
  it("locks on different workstreams do not interfere", () => {
    acquireLock(MID, "WS-001", SESSION_A, "alice", URL_A);
    const result = acquireLock(MID, "WS-002", SESSION_B, "bob", URL_B);
    expect("conflict" in result).toBe(false);
  });
});
