import type { MissionStatus } from "@/lib/schemas/mission";
import type { CanonicalTransitionCommand } from "@/lib/schemas/mission";

/**
 * Mission status transitions only (separate from Intake readiness and Sync status).
 * `ready` means ready_for_planning (semantic lock — do not rename without ADR).
 * Post-mapping `understanding` is not used in MVP command paths (Architecture Contract §3.2).
 */
export const TRANSITION_ALLOWED: Record<
  MissionStatus,
  Partial<Record<CanonicalTransitionCommand, MissionStatus>>
> = {
  draft: { mission_cancel: "cancelled" },
  ready: { mission_block: "blocked", mission_cancel: "cancelled" },
  understanding: { mission_block: "blocked", mission_cancel: "cancelled" },
  blocked: { mission_ready: "ready", mission_cancel: "cancelled" },
  cancelled: {},
};

export const TRANSITION_COMMANDS: CanonicalTransitionCommand[] = [
  "mission_block",
  "mission_ready",
  "mission_cancel",
];

export type TransitionAvailability = {
  command: CanonicalTransitionCommand;
  allowed: boolean;
  next_status: MissionStatus | null;
  reason: string;
};

export function getTransitionAvailability(status: MissionStatus): TransitionAvailability[] {
  return TRANSITION_COMMANDS.map((command) => {
    const next = TRANSITION_ALLOWED[status]?.[command] ?? null;
    if (next) {
      return {
        command,
        allowed: true,
        next_status: next,
        reason: `Allowed: ${status} → ${next}`,
      };
    }
    return {
      command,
      allowed: false,
      next_status: null,
      reason: `Unavailable from status "${status}"`,
    };
  });
}

export function isTransitionAllowed(
  status: MissionStatus,
  command: CanonicalTransitionCommand,
): boolean {
  return Boolean(TRANSITION_ALLOWED[status]?.[command]);
}
