import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import {
  assertAcyclicDependencies,
  assertCapabilitiesFollowWork,
  assertIntegrationRule,
  assertNonGenericWorkstreamTitles,
  WorkstreamPlanSchema,
} from "@/lib/orchestration/workstream-plan";

const examplesDir = join(process.cwd(), "../../data/seeds/decomposer-examples");

describe("ADR-006.v2 decomposer example suite", () => {
  const files = readdirSync(examplesDir).filter((f) => f.endsWith(".json"));

  it("loads multiple domain-diverse fixtures", () => {
    expect(files.length).toBeGreaterThanOrEqual(5);
  });

  for (const file of files) {
    it(`validates ${file}`, () => {
      const raw = JSON.parse(readFileSync(join(examplesDir, file), "utf8"));
      const plan = WorkstreamPlanSchema.parse(raw);

      expect(plan.decomposer_version).toBe("ADR-006.v2");
      expect(plan.workstreams.every((w) => w.primary_operator === "unassigned")).toBe(
        true,
      );

      const dag = assertAcyclicDependencies(plan.workstreams);
      expect(dag).toEqual({ ok: true });

      const caps = assertCapabilitiesFollowWork(plan.workstreams);
      expect(caps).toEqual({ ok: true });

      const integ = assertIntegrationRule(plan);
      expect(integ).toEqual({ ok: true });

      const generic = assertNonGenericWorkstreamTitles(plan.workstreams, {
        allowClarify: plan.domain === "unknown",
      });
      expect(generic.ok).toBe(true);

      // Variable count: fixtures must not all share the same length
      expect(plan.workstreams.length).toBeGreaterThanOrEqual(1);

      // Capabilities only after work fields exist (structural)
      for (const ws of plan.workstreams) {
        expect(ws.objective.length).toBeGreaterThan(10);
        expect(ws.expected_output.description.length).toBeGreaterThan(5);
        expect(ws.acceptance_criteria.length).toBeGreaterThan(0);
        expect(ws.required_capabilities.length).toBeGreaterThan(0);
        expect(ws.reasoning_action_refs.length).toBeGreaterThan(0);
      }

      // Infer-don't-ask: non-ambiguous/non-unsafe examples should have empty owner_questions
      if (plan.domain !== "unknown" && plan.domain !== "blocked_unsafe") {
        expect(plan.owner_questions).toEqual([]);
        expect(plan.explicit_assumptions.length).toBeGreaterThan(0);
      }
    });
  }

  it("rejects the old generic single-execute pattern", () => {
    const generic = assertNonGenericWorkstreamTitles([
      { title: "Understand scope" },
      { title: "Create main output" },
      { title: "Execute: do the mission" },
    ]);
    expect(generic.ok).toBe(false);
  });

  it("covers distinct domains across fixtures", () => {
    const domains = new Set(
      files.map((f) => {
        const raw = JSON.parse(readFileSync(join(examplesDir, f), "utf8"));
        return WorkstreamPlanSchema.parse(raw).domain;
      }),
    );
    expect(domains.has("business_research")).toBe(true);
    expect(domains.has("software")).toBe(true);
    expect(domains.has("automation")).toBe(true);
    expect(domains.has("executive_reporting")).toBe(true);
    expect(domains.has("architecture")).toBe(true);
    expect(domains.has("unknown")).toBe(true);
    expect(domains.has("blocked_unsafe")).toBe(true);
  });

  it("does not force a fixed workstream count across domains", () => {
    const lengths = new Set(
      files.map((f) => {
        const raw = JSON.parse(readFileSync(join(examplesDir, f), "utf8"));
        return WorkstreamPlanSchema.parse(raw).workstreams.length;
      }),
    );
    expect(lengths.size).toBeGreaterThan(1);
  });
});
