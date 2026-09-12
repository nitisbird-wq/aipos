import { promises as fs } from "fs";
import path from "path";
import { afterEach, describe, expect, it } from "vitest";
import { DevFileRepository } from "./dev-file-store";
import type { AuditEvent } from "@/lib/schemas/policy";

const tmpRoot = path.join(process.cwd(), ".data-test-dev-file-concurrent");

afterEach(async () => {
  await fs.rm(tmpRoot, { recursive: true, force: true });
});

function auditEvent(index: number): AuditEvent {
  return {
    id: `AUD-CONCURRENT-${index}`,
    aggregate_type: "intake",
    mission_id: null,
    intake_id: "INT-CONCURRENT",
    actor: "test",
    action: "concurrent:append",
    reason: `concurrent write ${index}`,
    correlation_id: `COR-CONCURRENT-${index}`,
    causation_id: null,
    previous_state: null,
    new_state: "awaiting_confirmation",
    policy_result: { decision: "allow" },
    created_at: new Date(Date.UTC(2026, 8, 9, 0, 0, index)).toISOString(),
  };
}

describe("DevFileRepository concurrent persistence", () => {
  it("serializes mutations across repository instances without losing audit events", async () => {
    const first = new DevFileRepository(tmpRoot);
    const second = new DevFileRepository(tmpRoot);
    const events = Array.from({ length: 24 }, (_, index) => auditEvent(index));

    await Promise.all(
      events.map((event, index) => (index % 2 === 0 ? first : second).appendAudit(event)),
    );

    const persisted = await first.listAudit({ intake_id: "INT-CONCURRENT" });
    expect(persisted).toHaveLength(events.length);
    expect(new Set(persisted.map((event) => event.id)).size).toBe(events.length);

    const raw = await fs.readFile(path.join(tmpRoot, "dev-store.json"), "utf8");
    expect(() => JSON.parse(raw)).not.toThrow();
    expect((await fs.readdir(tmpRoot)).filter((name) => name.endsWith(".tmp"))).toEqual([]);
  });
});
