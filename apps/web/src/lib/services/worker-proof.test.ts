/**
 * Stage 7B Real Worker Proof — unit tests.
 *
 * Verifies: L0 authority enforcement, idempotency, readback, handoff shape,
 * and forbidden-action enforcement (no external writes).
 * No live network calls; uses the same mock-backed repository as other services.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import type { MissionControlState } from "@/lib/schemas/contracts";
import type { WorkerAssignmentPackage } from "@/lib/services/operator-contract";

// ─── Mock control-plane state ─────────────────────────────────────────────────

const mockState: MissionControlState = {
  state_version: "control-plane.v1",
  mission_id: "MIS-TEST-WORKER",
  mission_state: "APPROVED",
  next_action: "Dispatch worker",
  responsible: "worker",
  workstreams: [],
  agent_runs: [],
  handoffs: [],
  artifacts: [],
  verifications: [],
  blockers: [],
  updated_at: "2026-09-12T00:00:00.000Z",
};

let currentState: MissionControlState = { ...mockState, artifacts: [] };

vi.mock("@/lib/services/control-plane-state", () => ({
  getMissionControlState: vi.fn(async () => currentState),
  upsertMissionControlState: vi.fn(
    async (_missionId: string, _actor: string, patch: Partial<MissionControlState>) => {
      currentState = { ...currentState, ...patch };
      return currentState;
    },
  ),
}));

// ─── Tests ────────────────────────────────────────────────────────────────────

const basePkg: WorkerAssignmentPackage = {
  mission_id: "MIS-TEST-WORKER",
  workstream_id: "WS-001",
  run_id: "RUN-MIS-TEST-WORKER-1",
  scoped_context: [
    "Mission: MIS-TEST-WORKER",
    "Objective: Research Stage 7B worker proof architecture",
    "Dependencies: none",
  ],
  tools_allowed: ["repo_read", "artifacts"],
  expected_output: ["research_artifact"],
  evidence_requirements: ["execution_log", "artifact_ref"],
  authority_level: "L0",
  high_impact_actions_allowed: false,
};

describe("runWorkerProof", () => {
  beforeEach(() => {
    currentState = { ...mockState, artifacts: [] };
    vi.clearAllMocks();
  });

  it("generates a research artifact on first run", async () => {
    const { runWorkerProof } = await import("@/lib/services/worker-proof");
    const result = await runWorkerProof({ pkg: basePkg, idempotencyKey: "IK-001" });

    expect(result.idempotent_reuse).toBe(false);
    expect(result.readback_matched).toBe(true);
    expect(result.authority_level).toBe("L0");
    expect(result.artifact_uri).toContain("worker-proof://");
    expect(result.artifact.artifact_version).toBe("research-artifact.v1");
    expect(result.artifact.authority_level).toBe("L0");
    expect(result.artifact.findings.length).toBeGreaterThan(0);
  });

  it("returns idempotent_reuse=true on second call with same key", async () => {
    const { runWorkerProof } = await import("@/lib/services/worker-proof");

    const first = await runWorkerProof({ pkg: basePkg, idempotencyKey: "IK-002" });
    expect(first.idempotent_reuse).toBe(false);

    const second = await runWorkerProof({ pkg: basePkg, idempotencyKey: "IK-002" });
    expect(second.idempotent_reuse).toBe(true);
    expect(second.readback_matched).toBe(true);
    expect(second.artifact_uri).toBe(first.artifact_uri);
  });

  it("produces a handoff that passes the verifier evaluator", async () => {
    const { runWorkerProof } = await import("@/lib/services/worker-proof");
    const { evaluateHandoffVerification } = await import("@/lib/services/verifier");

    const result = await runWorkerProof({ pkg: basePkg, idempotencyKey: "IK-003" });
    const decision = evaluateHandoffVerification(result.handoff);

    expect(decision.pass).toBe(true);
    expect(decision.reasons).toHaveLength(0);
    expect(decision.evidence_ok).toBe(true);
  });

  it("enforces L0 authority even if package requests higher level", async () => {
    const { runWorkerProof } = await import("@/lib/services/worker-proof");
    const elevatedPkg: WorkerAssignmentPackage = {
      ...basePkg,
      authority_level: "L3",
    };
    const result = await runWorkerProof({ pkg: elevatedPkg, idempotencyKey: "IK-004" });
    expect(result.authority_level).toBe("L0");
  });

  it("artifact URI is deterministic for the same inputs", async () => {
    const { runWorkerProof } = await import("@/lib/services/worker-proof");
    const r1 = await runWorkerProof({ pkg: basePkg, idempotencyKey: "IK-005" });

    currentState = { ...mockState, artifacts: [] }; // reset state
    const r2 = await runWorkerProof({ pkg: basePkg, idempotencyKey: "IK-005" });

    expect(r1.artifact_uri).toBe(r2.artifact_uri);
    expect(r1.artifact_uri).toContain("IK-005");
  });

  it("handoff status is PASS with no external writes", async () => {
    const { runWorkerProof } = await import("@/lib/services/worker-proof");
    const result = await runWorkerProof({ pkg: basePkg, idempotencyKey: "IK-006" });

    expect(result.handoff.status).toBe("PASS");
    expect(result.handoff.requires_human).toBe(false);
    expect(result.handoff.evidence.every((e) => e.verified_by === "worker:research-l0")).toBe(true);
    // Confirm no external write claim — all evidence is app_persisted
    expect(result.handoff.evidence.every((e) => e.status === "app_persisted")).toBe(true);
  });

  it("audit trail records all steps including readback", async () => {
    const { runWorkerProof } = await import("@/lib/services/worker-proof");
    const result = await runWorkerProof({ pkg: basePkg, idempotencyKey: "IK-007" });

    const steps = result.audit_trail.map((e) => e.step);
    expect(steps).toContain("start");
    expect(steps).toContain("authority_check");
    expect(steps).toContain("generate");
    expect(steps).toContain("persisted");
    expect(steps).toContain("readback");
    expect(steps).toContain("done");
  });
});
