"use client";

import type { MissionStatus } from "@/lib/schemas/mission";
import type { CanonicalTransitionCommand } from "@/lib/schemas/mission";
import {
  getTransitionAvailability,
  type TransitionAvailability,
} from "@/lib/services/transition-rules";

const LABELS: Record<CanonicalTransitionCommand, string> = {
  mission_block: "Block",
  mission_ready: "Unblock / Ready",
  mission_cancel: "Cancel",
};

export function TransitionControls({
  status,
  busy,
  onTransition,
}: {
  status: MissionStatus;
  busy: boolean;
  onTransition: (command: CanonicalTransitionCommand) => void;
}) {
  const availability: TransitionAvailability[] = getTransitionAvailability(status);

  return (
    <div className="space-y-3">
      <p className="text-xs text-[var(--ink-muted)]">
        No direct status PATCH — commands only (AIPOS-GOV-003). Showing only actions allowed from{" "}
        <strong>{status}</strong>.
      </p>
      <div className="flex flex-wrap gap-2">
        {availability.map((item) => {
          const isDanger = item.command === "mission_cancel";
          return (
            <button
              key={item.command}
              className={isDanger ? "btn btn-danger" : "btn btn-secondary"}
              type="button"
              disabled={busy || !item.allowed}
              title={item.reason}
              aria-disabled={!item.allowed}
              onClick={() => item.allowed && onTransition(item.command)}
            >
              {LABELS[item.command]}
            </button>
          );
        })}
      </div>
      <ul className="space-y-1 text-xs text-[var(--ink-muted)]">
        {availability
          .filter((a) => !a.allowed)
          .map((a) => (
            <li key={a.command}>
              <strong>{LABELS[a.command]}</strong>: {a.reason}
            </li>
          ))}
      </ul>
    </div>
  );
}
