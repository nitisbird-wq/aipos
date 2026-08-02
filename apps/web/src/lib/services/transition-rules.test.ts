import { describe, expect, it } from "vitest";
import { getTransitionAvailability, isTransitionAllowed } from "@/lib/services/transition-rules";

describe("transition buttons by state", () => {
  it("ready allows mission_block and mission_cancel; not mission_ready", () => {
    const avail = getTransitionAvailability("ready");
    const map = Object.fromEntries(avail.map((a) => [a.command, a]));
    expect(map.mission_block.allowed).toBe(true);
    expect(map.mission_cancel.allowed).toBe(true);
    expect(map.mission_ready.allowed).toBe(false);
    expect(map.mission_ready.reason).toMatch(/Unavailable from status "ready"/);
  });

  it("blocked allows mission_ready and mission_cancel only", () => {
    expect(isTransitionAllowed("blocked", "mission_ready")).toBe(true);
    expect(isTransitionAllowed("blocked", "mission_cancel")).toBe(true);
    expect(isTransitionAllowed("blocked", "mission_block")).toBe(false);
  });

  it("cancelled allows no transitions", () => {
    const avail = getTransitionAvailability("cancelled");
    expect(avail.every((a) => !a.allowed)).toBe(true);
  });

  it("invalid mission_ready from ready is not allowed", () => {
    expect(isTransitionAllowed("ready", "mission_ready")).toBe(false);
  });
});
