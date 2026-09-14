/**
 * Workstream edit-lock store — file-backed, atomic cross-request.
 *
 * Leases are persisted to .data/ws-leases.json using the same
 * temp-file + atomic rename pattern as DevFileRepository, serialised
 * through a per-file promise queue so concurrent requests cannot
 * interleave a read-modify-write.
 *
 * Limitation: only protects sessions that go through this API.
 * External AI sessions that do not call /lock cannot be detected.
 */

import { promises as fs } from "fs";
import path from "path";
import { randomUUID } from "crypto";

export type WorkstreamLock = {
  sessionId: string;
  actor: string;
  acquiredAt: string;
  expiresAt: string;
  planUrl: string;
};

type LockConflict = { conflict: WorkstreamLock };
type LeaseData = Record<string, WorkstreamLock>;

const LOCK_TTL_MS = 5 * 60 * 1000;

function lockKey(missionId: string, wsId: string): string {
  return `${missionId}:${wsId}`;
}

function isExpiredAt(lock: WorkstreamLock, now: number): boolean {
  return new Date(lock.expiresAt).getTime() <= now;
}

/** Validate that planUrl is an internal /intake/…/plan path (relative or absolute). */
export function isValidPlanUrl(url: string): boolean {
  try {
    const pathname = url.startsWith("http") ? new URL(url).pathname : url.split("?")[0];
    return /^\/intake\/[^/]+\/plan$/.test(pathname ?? "");
  } catch {
    return false;
  }
}

class LeaseStore {
  private static queues = new Map<string, Promise<void>>();

  readonly filePath: string;

  constructor(baseDir?: string) {
    const root = baseDir ?? path.join(process.cwd(), ".data");
    this.filePath = path.join(root, "ws-leases.json");
  }

  private async readLeases(): Promise<LeaseData> {
    try {
      const raw = await fs.readFile(this.filePath, "utf8");
      return JSON.parse(raw) as LeaseData;
    } catch {
      return {};
    }
  }

  private async writeAtomic(data: LeaseData): Promise<void> {
    await fs.mkdir(path.dirname(this.filePath), { recursive: true });
    const tmp = `${this.filePath}.${process.pid}.${randomUUID()}.tmp`;
    try {
      await fs.writeFile(tmp, JSON.stringify(data, null, 2), "utf8");
      await fs.rename(tmp, this.filePath);
    } catch (err) {
      await fs.rm(tmp, { force: true }).catch(() => undefined);
      throw err;
    }
  }

  private enqueue<T>(op: () => Promise<T>): Promise<T> {
    const prev = LeaseStore.queues.get(this.filePath) ?? Promise.resolve();
    const current = prev.catch(() => undefined).then(op);
    LeaseStore.queues.set(
      this.filePath,
      current.then(
        () => undefined,
        () => undefined,
      ),
    );
    return current;
  }

  async acquire(
    missionId: string,
    wsId: string,
    sessionId: string,
    actor: string,
    planUrl: string,
  ): Promise<WorkstreamLock | LockConflict> {
    const key = lockKey(missionId, wsId);
    return this.enqueue(async () => {
      const data = await this.readLeases();
      const existing = data[key];
      const now = Date.now();
      if (existing && !isExpiredAt(existing, now) && existing.sessionId !== sessionId) {
        return { conflict: existing };
      }
      const lease: WorkstreamLock = {
        sessionId,
        actor,
        acquiredAt: new Date(now).toISOString(),
        expiresAt: new Date(now + LOCK_TTL_MS).toISOString(),
        planUrl,
      };
      await this.writeAtomic({ ...data, [key]: lease });
      return lease;
    });
  }

  async release(missionId: string, wsId: string, sessionId: string): Promise<boolean> {
    const key = lockKey(missionId, wsId);
    return this.enqueue(async () => {
      const data = await this.readLeases();
      const existing = data[key];
      if (!existing || existing.sessionId !== sessionId) return false;
      const { [key]: _removed, ...rest } = data;
      await this.writeAtomic(rest);
      return true;
    });
  }

  async check(
    missionId: string,
    wsId: string,
    sessionId: string | null,
  ): Promise<WorkstreamLock | null> {
    const data = await this.readLeases();
    const key = lockKey(missionId, wsId);
    const existing = data[key];
    if (!existing || isExpiredAt(existing, Date.now())) return null;
    if (sessionId !== null && existing.sessionId === sessionId) return null;
    return existing;
  }

  async clearAll(): Promise<void> {
    return this.enqueue(async () => {
      await this.writeAtomic({});
    });
  }
}

let _store = new LeaseStore();

/** For test isolation — call before each test with a temp directory. */
export function _setLeaseStoreBaseDir(dir: string): void {
  _store = new LeaseStore(dir);
  // Reset static queue for this new path
  LeaseStore["queues"].delete(_store.filePath);
}

export async function acquireLock(
  missionId: string,
  wsId: string,
  sessionId: string,
  actor: string,
  planUrl: string,
): Promise<WorkstreamLock | { conflict: WorkstreamLock }> {
  return _store.acquire(missionId, wsId, sessionId, actor, planUrl);
}

export async function releaseLock(
  missionId: string,
  wsId: string,
  sessionId: string,
): Promise<boolean> {
  return _store.release(missionId, wsId, sessionId);
}

export async function checkLock(
  missionId: string,
  wsId: string,
  sessionId: string | null,
): Promise<WorkstreamLock | null> {
  return _store.check(missionId, wsId, sessionId);
}

/** For testing only — clears all leases and resets the store. */
export async function _clearLocksForTest(): Promise<void> {
  await _store.clearAll();
}
