/**
 * In-process workstream edit lock store.
 *
 * A lock is acquired when a user opens the Edit modal and released when they
 * save or cancel.  The TTL ensures stale locks (abandoned tabs, crashes)
 * expire automatically.
 *
 * Limitation: this store lives in the server process.  It cannot detect edits
 * happening in external sessions (ChatGPT, other Claude windows, a second
 * Next.js process) that do not go through this API.  The system only protects
 * against collisions it has observed.
 */

const LOCK_TTL_MS = 5 * 60 * 1000; // 5 minutes

export type WorkstreamLock = {
  sessionId: string;
  actor: string;
  acquiredAt: string;
  expiresAt: string;
  planUrl: string;
};

type LockConflict = { conflict: WorkstreamLock };

function lockKey(missionId: string, wsId: string): string {
  return `${missionId}:${wsId}`;
}

// Module-level singleton — intentional (one process, one store).
const locks = new Map<string, WorkstreamLock>();

function isExpired(lock: WorkstreamLock): boolean {
  return new Date(lock.expiresAt) <= new Date();
}

/**
 * Try to acquire (or renew) the edit lock for a workstream.
 * Returns the lock on success, or `{ conflict: existingLock }` if another
 * session holds a live lock.
 */
export function acquireLock(
  missionId: string,
  wsId: string,
  sessionId: string,
  actor: string,
  planUrl: string,
): WorkstreamLock | LockConflict {
  const key = lockKey(missionId, wsId);
  const existing = locks.get(key);
  if (existing && !isExpired(existing) && existing.sessionId !== sessionId) {
    return { conflict: existing };
  }
  const now = new Date();
  const lock: WorkstreamLock = {
    sessionId,
    actor,
    acquiredAt: now.toISOString(),
    expiresAt: new Date(now.getTime() + LOCK_TTL_MS).toISOString(),
    planUrl,
  };
  locks.set(key, lock);
  return lock;
}

/**
 * Release the lock.  Only the session that holds the lock can release it.
 * Returns true if released, false if the lock was held by a different session.
 */
export function releaseLock(missionId: string, wsId: string, sessionId: string): boolean {
  const key = lockKey(missionId, wsId);
  const existing = locks.get(key);
  if (!existing || existing.sessionId !== sessionId) return false;
  locks.delete(key);
  return true;
}

/**
 * Check whether a different session holds a live lock on this workstream.
 * Returns the conflicting lock, or null if the workstream is free / held by
 * the same session.
 *
 * Pass sessionId = null to check without an identity (treat any lock as conflict).
 */
export function checkLock(
  missionId: string,
  wsId: string,
  sessionId: string | null,
): WorkstreamLock | null {
  const key = lockKey(missionId, wsId);
  const existing = locks.get(key);
  if (!existing || isExpired(existing)) {
    if (existing) locks.delete(key);
    return null;
  }
  if (sessionId !== null && existing.sessionId === sessionId) return null;
  return existing;
}

/** For testing only — resets all lock state between test cases. */
export function _clearLocksForTest(): void {
  locks.clear();
}
