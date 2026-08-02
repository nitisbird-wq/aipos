"use client";

import { FormEvent, useState } from "react";

/**
 * Collapsible structured form — Advanced mission details fallback.
 * Not the primary intake experience.
 */
export function AdvancedMissionDetails({
  disabled,
  onSubmitStructured,
}: {
  disabled?: boolean;
  onSubmitStructured: (payload: {
    raw_request: string;
    constraints: string[];
    deadline: string | null;
  }) => void;
}) {
  const [open, setOpen] = useState(false);
  const [raw, setRaw] = useState("");
  const [constraints, setConstraints] = useState("");
  const [deadline, setDeadline] = useState("");

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!raw.trim()) return;
    onSubmitStructured({
      raw_request: raw.trim(),
      constraints: constraints
        .split("\n")
        .map((s) => s.trim())
        .filter(Boolean),
      deadline: deadline ? new Date(deadline).toISOString() : null,
    });
  }

  return (
    <div className="advanced-details panel">
      <button
        type="button"
        className="advanced-toggle"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        {open ? "Hide" : "Show"} advanced mission details
        <span className="text-[var(--ink-muted)]"> (structured form fallback)</span>
      </button>
      {open && (
        <form className="space-y-3 border-t border-[var(--border)] p-4" onSubmit={onSubmit}>
          <p className="text-xs text-[var(--ink-muted)]">
            Prefer the conversation above. Use this only when you need structured fields.
          </p>
          <div className="field">
            <label htmlFor="adv_raw">Mission request</label>
            <textarea
              id="adv_raw"
              value={raw}
              onChange={(e) => setRaw(e.target.value)}
              disabled={disabled}
              required
            />
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <div className="field">
              <label htmlFor="adv_constraints">Constraints</label>
              <textarea
                id="adv_constraints"
                className="!min-h-[80px]"
                value={constraints}
                onChange={(e) => setConstraints(e.target.value)}
                disabled={disabled}
              />
            </div>
            <div className="field">
              <label htmlFor="adv_deadline">Deadline (optional)</label>
              <input
                id="adv_deadline"
                type="datetime-local"
                value={deadline}
                onChange={(e) => setDeadline(e.target.value)}
                disabled={disabled}
              />
            </div>
          </div>
          <button className="btn btn-secondary" type="submit" disabled={disabled || !raw.trim()}>
            Submit via advanced form
          </button>
        </form>
      )}
    </div>
  );
}
