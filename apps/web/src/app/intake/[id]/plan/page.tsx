"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import type { PlanReviewState, OutcomeWorkstream, OwnerQuestion } from "@/lib/schemas/contracts";

// ── Types ─────────────────────────────────────────────────────────────────────

type ApiResponse<T> = { ok: boolean; plan?: T; error?: string };

type EditState = {
  wsId: string;
  title: string;
  objective: string;
  reason_required: string;
  proposed_actions: string;
  execution_steps: string;
  proposed_worker: string;
  proposed_tools: string;
  inputs: string;
  expected_output: string;
  evidence_requirements: string;
  dependencies: string;
  acceptance_criteria: string;
  owner_notes: string;
};

type AddState = {
  title: string;
  objective: string;
  reason_required: string;
  proposed_actions: string;
  execution_steps: string;
  proposed_worker: string;
  proposed_tools: string;
  inputs: string;
  expected_output: string;
  evidence_requirements: string;
  dependencies: string;
  acceptance_criteria: string;
  risk_level: OutcomeWorkstream["risk_level"];
  approval_required: boolean;
  parallelizable: boolean;
  human_gate_required: boolean;
  authority_level: OutcomeWorkstream["authority_level"];
  recovery_strategy: string;
  owner_notes: string;
};

// ── Constants ─────────────────────────────────────────────────────────────────

const APPROVAL_STYLE: Record<string, { label: string; bg: string; text: string; border: string }> =
  {
    PROPOSED: { label: "Proposed", bg: "#fffbeb", text: "#78350f", border: "#fcd34d" },
    APPROVED: { label: "Approved", bg: "#eff6ff", text: "#1d4ed8", border: "#93c5fd" },
    DISPATCHABLE: { label: "Dispatchable", bg: "#f0fdf4", text: "#15803d", border: "#86efac" },
  };

const RISK_STYLE: Record<string, { color: string; label: string }> = {
  L0: { color: "#16a34a", label: "L0" },
  L1: { color: "#0f6b4c", label: "L1" },
  L2: { color: "#8a6d1f", label: "L2" },
  L3: { color: "#c2410c", label: "L3" },
  L4: { color: "#9b2c2c", label: "L4" },
};

const RISK_LEVELS: OutcomeWorkstream["risk_level"][] = ["L0", "L1", "L2", "L3", "L4"];
const AUTHORITY_LEVELS: OutcomeWorkstream["authority_level"][] = ["L0", "L1", "L2", "L3", "L4"];

// ── Helpers ───────────────────────────────────────────────────────────────────

function splitLines(s: string): string[] {
  return s
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
}
function splitComma(s: string): string[] {
  return s
    .split(",")
    .map((l) => l.trim())
    .filter(Boolean);
}
function joinLines(arr: string[]): string {
  return arr.join("\n");
}
function joinComma(arr: string[]): string {
  return arr.join(", ");
}

function maxRiskIdx(wss: OutcomeWorkstream[]): number {
  return wss.reduce((m, ws) => Math.max(m, RISK_LEVELS.indexOf(ws.risk_level)), 0);
}

function wsLabel(ws: OutcomeWorkstream): string {
  return `WS${ws.execution_order}`;
}

function resolveDeps(ids: string[], wss: OutcomeWorkstream[]): string {
  if (!ids.length) return "—";
  return ids
    .map((id) => {
      const found = wss.find((w) => w.workstream_id === id);
      return found ? `${wsLabel(found)}: ${found.title}` : id;
    })
    .join(", ");
}

function emptyAdd(): AddState {
  return {
    title: "",
    objective: "",
    reason_required: "",
    proposed_actions: "",
    execution_steps: "",
    proposed_worker: "",
    proposed_tools: "",
    inputs: "",
    expected_output: "",
    evidence_requirements: "",
    dependencies: "",
    acceptance_criteria: "",
    risk_level: "L1",
    approval_required: false,
    parallelizable: false,
    human_gate_required: false,
    authority_level: "L1",
    recovery_strategy: "",
    owner_notes: "",
  };
}

// ── Sub-components ────────────────────────────────────────────────────────────

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        fontSize: "0.7rem",
        fontWeight: 700,
        letterSpacing: "0.07em",
        textTransform: "uppercase",
        color: "var(--ink-muted)",
        marginBottom: "0.3rem",
      }}
    >
      {children}
    </div>
  );
}

function BulletList({ items, numbered }: { items: string[]; numbered?: boolean }) {
  if (!items.length)
    return <span style={{ color: "var(--ink-muted)", fontSize: "0.85rem" }}>—</span>;
  if (numbered) {
    return (
      <ol
        style={{
          paddingLeft: "1.4rem",
          margin: 0,
          display: "flex",
          flexDirection: "column",
          gap: "0.25rem",
        }}
      >
        {items.map((item, i) => (
          <li key={i} style={{ fontSize: "0.875rem", lineHeight: 1.5 }}>
            {item}
          </li>
        ))}
      </ol>
    );
  }
  return (
    <ul
      style={{
        paddingLeft: "1.2rem",
        margin: 0,
        display: "flex",
        flexDirection: "column",
        gap: "0.2rem",
      }}
    >
      {items.map((item, i) => (
        <li key={i} style={{ fontSize: "0.875rem", lineHeight: 1.5 }}>
          {item}
        </li>
      ))}
    </ul>
  );
}

function Chips({ items, accent }: { items: string[]; accent?: boolean }) {
  if (!items.length)
    return <span style={{ color: "var(--ink-muted)", fontSize: "0.85rem" }}>—</span>;
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: "0.3rem" }}>
      {items.map((item, i) => (
        <span
          key={i}
          style={{
            background: accent ? "var(--accent-soft)" : "#f0f4f2",
            color: accent ? "var(--accent)" : "var(--foreground)",
            border: "1px solid var(--border)",
            borderRadius: "5px",
            padding: "0.15rem 0.5rem",
            fontSize: "0.8rem",
            fontFamily: "var(--font-mono), monospace",
          }}
        >
          {item}
        </span>
      ))}
    </div>
  );
}

function DetailGrid({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))",
        gap: "1.25rem 1.5rem",
      }}
    >
      {children}
    </div>
  );
}

function DetailCell({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <SectionLabel>{label}</SectionLabel>
      {children}
    </div>
  );
}

function HumanGateBadge({ required }: { required: boolean }) {
  if (!required) return null;
  return (
    <span
      title="Human gate required — Owner must approve before this workstream can dispatch"
      style={{
        background: "#fef3c7",
        color: "#92400e",
        border: "1px solid #fcd34d",
        borderRadius: "5px",
        padding: "0.15rem 0.45rem",
        fontSize: "0.75rem",
        fontWeight: 700,
        display: "inline-flex",
        alignItems: "center",
        gap: "0.25rem",
      }}
    >
      ⚠ Human Gate
    </span>
  );
}

function RiskBadge({ level }: { level: string }) {
  const s = RISK_STYLE[level] ?? RISK_STYLE["L1"]!;
  return (
    <span
      style={{
        color: s.color,
        fontWeight: 700,
        fontSize: "0.75rem",
        fontFamily: "var(--font-mono), monospace",
        border: `1px solid ${s.color}33`,
        borderRadius: "5px",
        padding: "0.15rem 0.45rem",
        background: `${s.color}10`,
      }}
    >
      {s.label} Risk
    </span>
  );
}

function ApprovalBadge({ state }: { state: string }) {
  const s = APPROVAL_STYLE[state] ?? APPROVAL_STYLE["PROPOSED"]!;
  return (
    <span
      style={{
        background: s.bg,
        color: s.text,
        border: `1px solid ${s.border}`,
        borderRadius: "5px",
        padding: "0.15rem 0.55rem",
        fontSize: "0.78rem",
        fontWeight: 700,
      }}
    >
      {s.label}
    </span>
  );
}

// ── Edit field helpers ────────────────────────────────────────────────────────

function FieldInput({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <div className="field">
      <label>{label}</label>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        style={{ borderRadius: "8px" }}
      />
    </div>
  );
}

function FieldTextarea({
  label,
  hint,
  value,
  onChange,
  rows,
}: {
  label: string;
  hint?: string;
  value: string;
  onChange: (v: string) => void;
  rows?: number;
}) {
  return (
    <div className="field">
      <label>
        {label}
        {hint && (
          <span style={{ fontWeight: 400, marginLeft: "0.5rem", opacity: 0.7 }}>{hint}</span>
        )}
      </label>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={{ minHeight: rows ? `${rows * 1.6}rem` : undefined }}
      />
    </div>
  );
}

// ── Workstream card ───────────────────────────────────────────────────────────

function WorkstreamCard({
  ws,
  allWs,
  isBusy,
  onApprove,
  onEdit,
  onRemove,
  canRemove,
}: {
  ws: OutcomeWorkstream;
  allWs: OutcomeWorkstream[];
  isBusy: boolean;
  onApprove: () => void;
  onEdit: () => void;
  onRemove: () => void;
  canRemove: boolean;
}) {
  const apStyle = APPROVAL_STYLE[ws.approval_state] ?? APPROVAL_STYLE["PROPOSED"]!;

  return (
    <div
      style={{
        background: "var(--surface)",
        border: `1px solid ${ws.human_gate_required ? "#fcd34d" : "var(--border)"}`,
        borderLeft: `4px solid ${
          ws.approval_state === "DISPATCHABLE"
            ? "#86efac"
            : ws.approval_state === "APPROVED"
              ? "#93c5fd"
              : "#fcd34d"
        }`,
        borderRadius: "10px",
        overflow: "hidden",
      }}
    >
      {/* Card header — always visible */}
      <div style={{ padding: "0.9rem 1rem" }}>
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            alignItems: "flex-start",
            justifyContent: "space-between",
            gap: "0.5rem",
          }}
        >
          {/* Left: meta + title */}
          <div style={{ flex: "1 1 0", minWidth: 0 }}>
            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                alignItems: "center",
                gap: "0.4rem",
                marginBottom: "0.4rem",
              }}
            >
              {/* Execution order badge */}
              <span
                style={{
                  background: "var(--foreground)",
                  color: "var(--surface)",
                  borderRadius: "5px",
                  padding: "0.1rem 0.45rem",
                  fontSize: "0.75rem",
                  fontWeight: 700,
                  fontFamily: "var(--font-mono), monospace",
                  letterSpacing: "0.02em",
                }}
              >
                {wsLabel(ws)}
              </span>
              <ApprovalBadge state={ws.approval_state} />
              <RiskBadge level={ws.risk_level} />
              {ws.human_gate_required && <HumanGateBadge required />}
              {ws.parallelizable && (
                <span
                  style={{
                    color: "var(--ink-muted)",
                    fontSize: "0.72rem",
                    fontWeight: 600,
                    letterSpacing: "0.04em",
                  }}
                >
                  ∥ parallel
                </span>
              )}
            </div>
            <p
              style={{
                fontWeight: 700,
                fontSize: "0.95rem",
                marginBottom: "0.2rem",
                wordBreak: "break-word",
              }}
            >
              {ws.title}
            </p>
            <p
              style={{
                fontSize: "0.875rem",
                color: "var(--ink-muted)",
                wordBreak: "break-word",
                lineHeight: 1.5,
              }}
            >
              {ws.objective}
            </p>
            {ws.dependencies.length > 0 && (
              <p
                style={{
                  fontSize: "0.78rem",
                  color: "var(--ink-muted)",
                  marginTop: "0.3rem",
                  fontStyle: "italic",
                }}
              >
                Depends on: {resolveDeps(ws.dependencies, allWs)}
              </p>
            )}
          </div>

          {/* Right: action buttons */}
          <div style={{ display: "flex", flexWrap: "wrap", gap: "0.35rem", flexShrink: 0 }}>
            {ws.approval_state === "PROPOSED" && (
              <button
                className="btn btn-primary"
                style={{ fontSize: "0.8rem", padding: "0.45rem 0.8rem" }}
                disabled={isBusy}
                onClick={onApprove}
              >
                Approve
              </button>
            )}
            <button
              className="btn btn-secondary"
              style={{ fontSize: "0.8rem", padding: "0.45rem 0.8rem" }}
              disabled={isBusy}
              onClick={onEdit}
            >
              Edit
            </button>
            <button
              className="btn btn-danger"
              style={{ fontSize: "0.8rem", padding: "0.45rem 0.8rem" }}
              disabled={isBusy || !canRemove}
              title={!canRemove ? "Cannot remove last workstream" : undefined}
              onClick={onRemove}
            >
              Remove
            </button>
          </div>
        </div>

        {ws.owner_notes && (
          <p
            style={{
              marginTop: "0.5rem",
              fontSize: "0.8rem",
              color: "#7a5500",
              background: "#fefce8",
              border: "1px solid #fef08a",
              borderRadius: "6px",
              padding: "0.35rem 0.6rem",
            }}
          >
            <strong>Owner note:</strong> {ws.owner_notes}
          </p>
        )}
      </div>

      {/* Expandable full detail */}
      <details>
        <summary
          style={{
            padding: "0.55rem 1rem",
            cursor: "pointer",
            userSelect: "none",
            fontSize: "0.82rem",
            fontWeight: 600,
            color: "var(--ink-muted)",
            background: "#f7faf8",
            borderTop: "1px solid var(--border)",
            listStyle: "none",
            display: "flex",
            alignItems: "center",
            gap: "0.4rem",
          }}
        >
          <span style={{ fontSize: "0.7rem" }}>▶</span>
          Full workstream detail — who, how, inputs, outputs, evidence, failure recovery
        </summary>

        <div
          style={{
            padding: "1.25rem 1rem",
            borderTop: "1px solid var(--border)",
            display: "flex",
            flexDirection: "column",
            gap: "1.25rem",
          }}
        >
          {/* Q2: Why required */}
          <div>
            <SectionLabel>Why this workstream exists</SectionLabel>
            <p style={{ fontSize: "0.875rem", lineHeight: 1.6 }}>{ws.reason_required || "—"}</p>
          </div>

          {/* Q3: How — actions + steps */}
          <DetailGrid>
            <DetailCell label="Proposed actions (what to do)">
              <BulletList items={ws.proposed_actions} numbered />
            </DetailCell>
            <DetailCell label="Execution steps (how to do it)">
              <BulletList items={ws.execution_steps} numbered />
            </DetailCell>
          </DetailGrid>

          {/* Q4: Who & tools */}
          <DetailGrid>
            <DetailCell label="Assigned worker / agent">
              {ws.proposed_worker ? (
                <Chips items={[ws.proposed_worker]} accent />
              ) : (
                <span style={{ color: "var(--ink-muted)", fontSize: "0.85rem" }}>—</span>
              )}
            </DetailCell>
            <DetailCell label="Tools">
              <Chips items={ws.proposed_tools} />
            </DetailCell>
          </DetailGrid>

          {/* Q5 & Q6: Inputs & Outputs */}
          <DetailGrid>
            <DetailCell label="Required inputs">
              <BulletList items={ws.inputs} />
            </DetailCell>
            <DetailCell label="Expected output / artifact">
              <BulletList items={ws.expected_output} />
            </DetailCell>
          </DetailGrid>

          {/* Q7: Evidence */}
          <DetailCell label="Evidence requirements — what must be proved">
            <BulletList items={ws.evidence_requirements} />
          </DetailCell>

          {/* Q8: Dependencies */}
          <DetailCell label="Depends on (must complete first)">
            {ws.dependencies.length > 0 ? (
              <div style={{ display: "flex", flexWrap: "wrap", gap: "0.4rem" }}>
                {ws.dependencies.map((depId) => {
                  const dep = allWs.find((w) => w.workstream_id === depId);
                  return (
                    <span
                      key={depId}
                      style={{
                        background: "#f0f4f2",
                        border: "1px solid var(--border)",
                        borderRadius: "6px",
                        padding: "0.2rem 0.6rem",
                        fontSize: "0.82rem",
                        fontWeight: 600,
                      }}
                    >
                      {dep ? `${wsLabel(dep)}: ${dep.title}` : depId}
                    </span>
                  );
                })}
              </div>
            ) : (
              <span style={{ color: "var(--ink-muted)", fontSize: "0.85rem" }}>
                No dependencies — can start immediately
              </span>
            )}
          </DetailCell>

          {/* Acceptance criteria */}
          <DetailCell label="Acceptance criteria — done when">
            <BulletList items={ws.acceptance_criteria} />
          </DetailCell>

          {/* Q9: On failure */}
          <DetailCell label="On failure — recovery strategy">
            <p
              style={{
                fontSize: "0.875rem",
                lineHeight: 1.6,
                color: ws.recovery_strategy ? "var(--foreground)" : "var(--ink-muted)",
              }}
            >
              {ws.recovery_strategy || "—"}
            </p>
          </DetailCell>

          {/* Q10: Authority & gate */}
          <DetailGrid>
            <DetailCell label="Authority level">
              <span
                style={{
                  fontFamily: "var(--font-mono), monospace",
                  fontWeight: 700,
                  fontSize: "0.9rem",
                  color:
                    ws.authority_level === "L4" || ws.authority_level === "L3"
                      ? "#9b2c2c"
                      : ws.authority_level === "L2"
                        ? "#8a6d1f"
                        : "var(--accent)",
                }}
              >
                {ws.authority_level}
              </span>
            </DetailCell>
            <DetailCell label="Human gate required">
              {ws.human_gate_required ? (
                <span
                  style={{
                    fontWeight: 700,
                    color: "#92400e",
                    display: "flex",
                    alignItems: "center",
                    gap: "0.3rem",
                    fontSize: "0.875rem",
                  }}
                >
                  ⚠ Yes — Owner must approve before dispatch
                </span>
              ) : (
                <span style={{ color: "var(--ok)", fontWeight: 600, fontSize: "0.875rem" }}>
                  No — can auto-dispatch
                </span>
              )}
            </DetailCell>
          </DetailGrid>
        </div>
      </details>
    </div>
  );
}

// ── Dependency flow strip ─────────────────────────────────────────────────────

function DependencyFlow({ workstreams }: { workstreams: OutcomeWorkstream[] }) {
  const sorted = [...workstreams].sort((a, b) => a.execution_order - b.execution_order);
  return (
    <div
      style={{
        overflowX: "auto",
        paddingBottom: "0.5rem",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 0,
          minWidth: "max-content",
        }}
      >
        {sorted.map((ws, idx) => {
          const apStyle = APPROVAL_STYLE[ws.approval_state] ?? APPROVAL_STYLE["PROPOSED"]!;
          return (
            <div key={ws.workstream_id} style={{ display: "flex", alignItems: "center", gap: 0 }}>
              <div
                style={{
                  background: apStyle.bg,
                  border: `1px solid ${apStyle.border}`,
                  borderRadius: "8px",
                  padding: "0.4rem 0.7rem",
                  fontSize: "0.78rem",
                  fontWeight: 600,
                  color: apStyle.text,
                  maxWidth: "160px",
                  textAlign: "center",
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                }}
                title={ws.title}
              >
                <div
                  style={{
                    fontFamily: "var(--font-mono), monospace",
                    fontWeight: 700,
                    fontSize: "0.7rem",
                    opacity: 0.7,
                    marginBottom: "0.15rem",
                  }}
                >
                  {wsLabel(ws)}
                </div>
                {ws.title.length > 22 ? ws.title.slice(0, 22) + "…" : ws.title}
                {ws.human_gate_required && (
                  <span style={{ marginLeft: "0.3rem", fontSize: "0.7rem" }} title="Human gate">
                    ⚠
                  </span>
                )}
              </div>
              {idx < sorted.length - 1 && (
                <div
                  style={{
                    color: "var(--ink-muted)",
                    fontSize: "0.9rem",
                    padding: "0 0.3rem",
                    flexShrink: 0,
                  }}
                >
                  →
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Mission summary panel ─────────────────────────────────────────────────────

function MissionSummary({ plan }: { plan: PlanReviewState }) {
  const wss = plan.workstreams;
  const humanGates = wss.filter((ws) => ws.human_gate_required).length;
  const maxRisk = RISK_LEVELS[maxRiskIdx(wss)] ?? "L1";
  const allCaps = Array.from(new Set(wss.flatMap((ws) => ws.required_capabilities)));
  const totalPending = wss.filter((ws) => ws.approval_state === "PROPOSED").length;

  return (
    <div
      className="panel"
      style={{ padding: "1rem 1.25rem", display: "flex", flexDirection: "column", gap: "0.75rem" }}
    >
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))",
          gap: "0.75rem 1.25rem",
        }}
      >
        <div>
          <SectionLabel>Workstreams</SectionLabel>
          <p
            style={{
              fontSize: "1.4rem",
              fontWeight: 700,
              fontFamily: "var(--font-mono), monospace",
            }}
          >
            {wss.length}
          </p>
        </div>
        <div>
          <SectionLabel>Awaiting approval</SectionLabel>
          <p
            style={{
              fontSize: "1.4rem",
              fontWeight: 700,
              fontFamily: "var(--font-mono), monospace",
              color: totalPending > 0 ? "#78350f" : "var(--ok)",
            }}
          >
            {totalPending}
          </p>
        </div>
        <div>
          <SectionLabel>Human gates</SectionLabel>
          <p
            style={{
              fontSize: "1.4rem",
              fontWeight: 700,
              fontFamily: "var(--font-mono), monospace",
              color: humanGates > 0 ? "#92400e" : "var(--ok)",
              display: "flex",
              alignItems: "center",
              gap: "0.3rem",
            }}
          >
            {humanGates > 0 && <span style={{ fontSize: "1rem" }}>⚠</span>}
            {humanGates}
          </p>
        </div>
        <div>
          <SectionLabel>Highest risk</SectionLabel>
          <p
            style={{
              fontSize: "1.4rem",
              fontWeight: 700,
              fontFamily: "var(--font-mono), monospace",
              color: RISK_STYLE[maxRisk]?.color ?? "var(--foreground)",
            }}
          >
            {maxRisk}
          </p>
        </div>
        <div>
          <SectionLabel>Capabilities required</SectionLabel>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "0.25rem", marginTop: "0.25rem" }}>
            {allCaps.slice(0, 5).map((cap) => (
              <span
                key={cap}
                style={{
                  background: "var(--accent-soft)",
                  color: "var(--accent)",
                  borderRadius: "4px",
                  padding: "0.1rem 0.4rem",
                  fontSize: "0.75rem",
                  fontWeight: 600,
                }}
              >
                {cap}
              </span>
            ))}
          </div>
        </div>
        <div>
          <SectionLabel>Plan status</SectionLabel>
          <p
            style={{
              fontWeight: 700,
              fontSize: "0.9rem",
              marginTop: "0.25rem",
              color:
                plan.review_status === "APPROVED"
                  ? "var(--ok)"
                  : plan.review_status === "IN_REVIEW"
                    ? "#1d4ed8"
                    : "#78350f",
            }}
          >
            {plan.review_status.replace("_", " ")}
          </p>
        </div>
      </div>

      <div>
        <SectionLabel>Execution flow</SectionLabel>
        <DependencyFlow workstreams={wss} />
      </div>
    </div>
  );
}

// ── Add / Edit modals ─────────────────────────────────────────────────────────

function EditModal({
  state,
  allWs,
  isBusy,
  onChange,
  onSubmit,
  onCancel,
}: {
  state: EditState;
  allWs: OutcomeWorkstream[];
  isBusy: boolean;
  onChange: (patch: Partial<EditState>) => void;
  onSubmit: () => void;
  onCancel: () => void;
}) {
  const currentWsId = state.wsId;
  const otherWs = allWs.filter((ws) => ws.workstream_id !== currentWsId);

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 50,
        display: "flex",
        alignItems: "flex-start",
        justifyContent: "center",
        background: "rgba(21,35,28,0.4)",
        padding: "1.5rem 1rem",
        overflowY: "auto",
      }}
    >
      <div
        style={{
          background: "var(--surface)",
          borderRadius: "14px",
          boxShadow: "0 20px 60px rgba(0,0,0,0.18)",
          width: "100%",
          maxWidth: "640px",
          display: "flex",
          flexDirection: "column",
          gap: "1.25rem",
          padding: "1.5rem",
        }}
      >
        <h2 style={{ fontSize: "1.1rem", fontWeight: 700, margin: 0 }}>Edit Workstream</h2>

        <FieldInput label="Title" value={state.title} onChange={(v) => onChange({ title: v })} />
        <FieldTextarea
          label="Objective"
          value={state.objective}
          onChange={(v) => onChange({ objective: v })}
          rows={2}
        />
        <FieldTextarea
          label="Why required"
          value={state.reason_required}
          onChange={(v) => onChange({ reason_required: v })}
          rows={2}
        />
        <FieldTextarea
          label="Proposed actions"
          hint="(one per line)"
          value={state.proposed_actions}
          onChange={(v) => onChange({ proposed_actions: v })}
          rows={4}
        />
        <FieldTextarea
          label="Execution steps"
          hint="(one per line)"
          value={state.execution_steps}
          onChange={(v) => onChange({ execution_steps: v })}
          rows={4}
        />
        <FieldInput
          label="Proposed worker / agent"
          value={state.proposed_worker}
          onChange={(v) => onChange({ proposed_worker: v })}
          placeholder="e.g. research_agent"
        />
        <FieldInput
          label="Tools (comma-separated)"
          value={state.proposed_tools}
          onChange={(v) => onChange({ proposed_tools: v })}
          placeholder="e.g. web_search, document_reader"
        />
        <FieldTextarea
          label="Required inputs"
          hint="(one per line)"
          value={state.inputs}
          onChange={(v) => onChange({ inputs: v })}
          rows={3}
        />
        <FieldTextarea
          label="Expected output / artifact"
          hint="(one per line)"
          value={state.expected_output}
          onChange={(v) => onChange({ expected_output: v })}
          rows={3}
        />
        <FieldTextarea
          label="Evidence requirements"
          hint="(one per line)"
          value={state.evidence_requirements}
          onChange={(v) => onChange({ evidence_requirements: v })}
          rows={3}
        />

        {/* Dependencies multi-select */}
        {otherWs.length > 0 && (
          <div className="field">
            <label>Dependencies (select workstreams that must complete first)</label>
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "0.3rem",
                border: "1px solid var(--border)",
                borderRadius: "8px",
                padding: "0.6rem 0.75rem",
                background: "#fcfdfc",
              }}
            >
              {otherWs
                .sort((a, b) => a.execution_order - b.execution_order)
                .map((ws) => {
                  const depIds = splitComma(state.dependencies);
                  const checked = depIds.includes(ws.workstream_id);
                  return (
                    <label
                      key={ws.workstream_id}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "0.5rem",
                        fontSize: "0.875rem",
                        cursor: "pointer",
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={(e) => {
                          const next = e.target.checked
                            ? [...depIds, ws.workstream_id]
                            : depIds.filter((id) => id !== ws.workstream_id);
                          onChange({ dependencies: next.join(",") });
                        }}
                      />
                      <span
                        style={{
                          fontFamily: "var(--font-mono), monospace",
                          fontWeight: 700,
                          fontSize: "0.78rem",
                          color: "var(--ink-muted)",
                        }}
                      >
                        {wsLabel(ws)}
                      </span>
                      {ws.title}
                    </label>
                  );
                })}
            </div>
          </div>
        )}

        <FieldTextarea
          label="Acceptance criteria"
          hint="(one per line)"
          value={state.acceptance_criteria}
          onChange={(v) => onChange({ acceptance_criteria: v })}
          rows={3}
        />
        <FieldInput
          label="Owner notes"
          value={state.owner_notes}
          onChange={(v) => onChange({ owner_notes: v })}
          placeholder="Optional notes for this workstream"
        />

        <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.5rem" }}>
          <button className="btn btn-secondary" onClick={onCancel}>
            Cancel
          </button>
          <button className="btn btn-primary" disabled={isBusy} onClick={onSubmit}>
            Save & Reset to Proposed
          </button>
        </div>
      </div>
    </div>
  );
}

function AddModal({
  state,
  allWs,
  isBusy,
  onChange,
  onSubmit,
  onCancel,
}: {
  state: AddState;
  allWs: OutcomeWorkstream[];
  isBusy: boolean;
  onChange: (patch: Partial<AddState>) => void;
  onSubmit: () => void;
  onCancel: () => void;
}) {
  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 50,
        display: "flex",
        alignItems: "flex-start",
        justifyContent: "center",
        background: "rgba(21,35,28,0.4)",
        padding: "1.5rem 1rem",
        overflowY: "auto",
      }}
    >
      <div
        style={{
          background: "var(--surface)",
          borderRadius: "14px",
          boxShadow: "0 20px 60px rgba(0,0,0,0.18)",
          width: "100%",
          maxWidth: "640px",
          display: "flex",
          flexDirection: "column",
          gap: "1.25rem",
          padding: "1.5rem",
        }}
      >
        <h2 style={{ fontSize: "1.1rem", fontWeight: 700, margin: 0 }}>Add Workstream</h2>

        <FieldInput label="Title" value={state.title} onChange={(v) => onChange({ title: v })} />
        <FieldTextarea
          label="Objective"
          value={state.objective}
          onChange={(v) => onChange({ objective: v })}
          rows={2}
        />
        <FieldTextarea
          label="Why required"
          value={state.reason_required}
          onChange={(v) => onChange({ reason_required: v })}
          rows={2}
        />
        <FieldTextarea
          label="Proposed actions"
          hint="(one per line)"
          value={state.proposed_actions}
          onChange={(v) => onChange({ proposed_actions: v })}
          rows={3}
        />
        <FieldTextarea
          label="Execution steps"
          hint="(one per line)"
          value={state.execution_steps}
          onChange={(v) => onChange({ execution_steps: v })}
          rows={3}
        />
        <FieldInput
          label="Worker / agent"
          value={state.proposed_worker}
          onChange={(v) => onChange({ proposed_worker: v })}
        />
        <FieldInput
          label="Tools (comma-separated)"
          value={state.proposed_tools}
          onChange={(v) => onChange({ proposed_tools: v })}
        />
        <FieldTextarea
          label="Required inputs"
          hint="(one per line)"
          value={state.inputs}
          onChange={(v) => onChange({ inputs: v })}
          rows={2}
        />
        <FieldTextarea
          label="Expected output"
          hint="(one per line)"
          value={state.expected_output}
          onChange={(v) => onChange({ expected_output: v })}
          rows={2}
        />
        <FieldTextarea
          label="Evidence requirements"
          hint="(one per line)"
          value={state.evidence_requirements}
          onChange={(v) => onChange({ evidence_requirements: v })}
          rows={2}
        />
        <FieldTextarea
          label="Recovery strategy (on failure)"
          value={state.recovery_strategy}
          onChange={(v) => onChange({ recovery_strategy: v })}
          rows={2}
        />

        {/* Dependencies */}
        {allWs.length > 0 && (
          <div className="field">
            <label>Dependencies</label>
            <div
              style={{
                border: "1px solid var(--border)",
                borderRadius: "8px",
                padding: "0.6rem 0.75rem",
                background: "#fcfdfc",
                display: "flex",
                flexDirection: "column",
                gap: "0.3rem",
              }}
            >
              {allWs
                .sort((a, b) => a.execution_order - b.execution_order)
                .map((ws) => {
                  const depIds = splitComma(state.dependencies);
                  const checked = depIds.includes(ws.workstream_id);
                  return (
                    <label
                      key={ws.workstream_id}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "0.5rem",
                        fontSize: "0.875rem",
                        cursor: "pointer",
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={(e) => {
                          const next = e.target.checked
                            ? [...depIds, ws.workstream_id]
                            : depIds.filter((id) => id !== ws.workstream_id);
                          onChange({ dependencies: next.join(",") });
                        }}
                      />
                      <span
                        style={{
                          fontFamily: "var(--font-mono), monospace",
                          fontWeight: 700,
                          fontSize: "0.78rem",
                          color: "var(--ink-muted)",
                        }}
                      >
                        {wsLabel(ws)}
                      </span>
                      {ws.title}
                    </label>
                  );
                })}
            </div>
          </div>
        )}

        <FieldTextarea
          label="Acceptance criteria"
          hint="(one per line)"
          value={state.acceptance_criteria}
          onChange={(v) => onChange({ acceptance_criteria: v })}
          rows={3}
        />

        {/* Risk / authority */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
          <div className="field">
            <label>Risk level</label>
            <select
              value={state.risk_level}
              onChange={(e) =>
                onChange({ risk_level: e.target.value as OutcomeWorkstream["risk_level"] })
              }
            >
              {RISK_LEVELS.map((l) => (
                <option key={l} value={l}>
                  {l}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label>Authority level</label>
            <select
              value={state.authority_level}
              onChange={(e) =>
                onChange({
                  authority_level: e.target.value as OutcomeWorkstream["authority_level"],
                })
              }
            >
              {AUTHORITY_LEVELS.map((l) => (
                <option key={l} value={l}>
                  {l}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div style={{ display: "flex", gap: "1.5rem", flexWrap: "wrap" }}>
          <label
            style={{
              display: "flex",
              alignItems: "center",
              gap: "0.5rem",
              fontSize: "0.875rem",
              cursor: "pointer",
            }}
          >
            <input
              type="checkbox"
              checked={state.approval_required}
              onChange={(e) => onChange({ approval_required: e.target.checked })}
            />
            Approval required
          </label>
          <label
            style={{
              display: "flex",
              alignItems: "center",
              gap: "0.5rem",
              fontSize: "0.875rem",
              cursor: "pointer",
            }}
          >
            <input
              type="checkbox"
              checked={state.parallelizable}
              onChange={(e) => onChange({ parallelizable: e.target.checked })}
            />
            Parallelizable
          </label>
          <label
            style={{
              display: "flex",
              alignItems: "center",
              gap: "0.5rem",
              fontSize: "0.875rem",
              cursor: "pointer",
            }}
          >
            <input
              type="checkbox"
              checked={state.human_gate_required}
              onChange={(e) => onChange({ human_gate_required: e.target.checked })}
            />
            Human gate required
          </label>
        </div>

        <FieldInput
          label="Owner notes"
          value={state.owner_notes}
          onChange={(v) => onChange({ owner_notes: v })}
        />

        <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.5rem" }}>
          <button className="btn btn-secondary" onClick={onCancel}>
            Cancel
          </button>
          <button className="btn btn-primary" disabled={isBusy} onClick={onSubmit}>
            Add Workstream
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function PlanReviewPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const missionId = params.id;

  const [plan, setPlan] = useState<PlanReviewState | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editState, setEditState] = useState<EditState | null>(null);
  const [addState, setAddState] = useState<AddState | null>(null);
  const [saving, setSaving] = useState<string | null>(null);
  const [lockConflict, setLockConflict] = useState<{
    actor: string;
    planUrl: string;
    wsTitle: string;
  } | null>(null);

  // Stable per-tab session identifier used to gate concurrent edits.
  const sessionIdRef = useRef<string>("");
  useEffect(() => {
    try {
      let id = sessionStorage.getItem("aipos_plan_session_id") ?? "";
      if (!id) {
        id = crypto.randomUUID();
        sessionStorage.setItem("aipos_plan_session_id", id);
      }
      sessionIdRef.current = id;
    } catch {
      sessionIdRef.current = crypto.randomUUID();
    }
  }, []);

  const base = `/api/missions/${missionId}/plan`;

  const fetchPlan = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(base);
      if (res.status === 404) {
        const genRes = await fetch(base, { method: "POST", body: "{}" });
        const data: ApiResponse<PlanReviewState> = await genRes.json();
        if (data.ok && data.plan) setPlan(data.plan);
        else setError("Failed to generate plan");
      } else {
        const data: ApiResponse<PlanReviewState> = await res.json();
        if (data.ok && data.plan) setPlan(data.plan);
        else setError("Failed to load plan");
      }
    } catch {
      setError("Network error loading plan");
    } finally {
      setLoading(false);
    }
  }, [base]);

  useEffect(() => {
    fetchPlan();
  }, [fetchPlan]);

  async function callApi(
    url: string,
    method: string,
    body?: unknown,
    wsTitle?: string,
  ): Promise<boolean> {
    setSaving(url);
    try {
      const res = await fetch(url, {
        method,
        headers: {
          "content-type": "application/json",
          "x-ws-session-id": sessionIdRef.current,
        },
        body: body !== undefined ? JSON.stringify(body) : undefined,
      });
      type RawResponse = {
        ok: boolean;
        plan?: PlanReviewState;
        error?: string | { code?: string; message?: string; lock?: { actor: string; planUrl: string } };
      };
      const data = (await res.json()) as RawResponse;
      if (data.ok && data.plan) {
        setPlan(data.plan);
        return true;
      }
      // Lock conflict: show banner instead of generic error
      if (res.status === 409 && typeof data.error === "object" && data.error !== null) {
        const errObj = data.error;
        if (errObj.code === "WORKSTREAM_LOCKED" && errObj.lock) {
          setLockConflict({
            actor: errObj.lock.actor,
            planUrl: errObj.lock.planUrl,
            wsTitle: wsTitle ?? url,
          });
          return false;
        }
      }
      const msg =
        typeof data.error === "object" && data.error !== null
          ? (data.error.message ?? "Request failed")
          : ((data.error as string | undefined) ?? "Request failed");
      setError(msg);
      return false;
    } catch {
      setError("Network error");
      return false;
    } finally {
      setSaving(null);
    }
  }

  async function acquireEditLock(wsId: string, wsTitle: string): Promise<boolean> {
    try {
      const res = await fetch(`${base}/workstreams/${wsId}/lock`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          sessionId: sessionIdRef.current,
          planUrl: window.location.href,
        }),
      });
      const data = await res.json() as {
        ok: boolean;
        error?: { code?: string; lock?: { actor: string; planUrl: string } };
      };
      if (data.ok) return true;
      if (res.status === 409 && data.error?.lock) {
        setLockConflict({ actor: data.error.lock.actor, planUrl: data.error.lock.planUrl, wsTitle });
      }
      return false;
    } catch {
      return true; // network error: optimistically allow (lock is best-effort)
    }
  }

  async function releaseEditLock(wsId: string): Promise<void> {
    try {
      await fetch(`${base}/workstreams/${wsId}/lock`, {
        method: "DELETE",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ sessionId: sessionIdRef.current }),
      });
    } catch {
      // best-effort; TTL will expire it
    }
  }

  async function approveWorkstream(wsId: string) {
    await callApi(`${base}/workstreams/${wsId}/approve`, "POST");
  }

  async function removeWorkstream(wsId: string, title: string) {
    if (!confirm(`Remove "${title}"? Dependencies referencing this workstream will be cleaned up.`))
      return;
    await callApi(`${base}/workstreams/${wsId}`, "DELETE");
  }

  async function startEdit(ws: OutcomeWorkstream) {
    const acquired = await acquireEditLock(ws.workstream_id, ws.title);
    if (!acquired) return; // lockConflict already set
    setLockConflict(null);
    setEditState({
      wsId: ws.workstream_id,
      title: ws.title,
      objective: ws.objective,
      reason_required: ws.reason_required,
      proposed_actions: joinLines(ws.proposed_actions),
      execution_steps: joinLines(ws.execution_steps),
      proposed_worker: ws.proposed_worker,
      proposed_tools: joinComma(ws.proposed_tools),
      inputs: joinLines(ws.inputs),
      expected_output: joinLines(ws.expected_output),
      evidence_requirements: joinLines(ws.evidence_requirements),
      dependencies: ws.dependencies.join(","),
      acceptance_criteria: joinLines(ws.acceptance_criteria),
      owner_notes: ws.owner_notes,
    });
  }

  async function submitEdit() {
    if (!editState) return;
    const wsId = editState.wsId;
    const ok = await callApi(
      `${base}/workstreams/${wsId}`,
      "PATCH",
      {
        title: editState.title,
        objective: editState.objective,
        reason_required: editState.reason_required,
        proposed_actions: splitLines(editState.proposed_actions),
        execution_steps: splitLines(editState.execution_steps),
        proposed_worker: editState.proposed_worker,
        proposed_tools: splitComma(editState.proposed_tools),
        inputs: splitLines(editState.inputs),
        expected_output: splitLines(editState.expected_output),
        evidence_requirements: splitLines(editState.evidence_requirements),
        dependencies: splitComma(editState.dependencies),
        acceptance_criteria: splitLines(editState.acceptance_criteria),
        owner_notes: editState.owner_notes,
      },
      editState.title,
    );
    if (ok) {
      await releaseEditLock(wsId);
      setEditState(null);
    }
  }

  async function cancelEdit() {
    if (editState) await releaseEditLock(editState.wsId);
    setEditState(null);
  }

  async function submitAdd() {
    if (!addState) return;
    const ok = await callApi(`${base}/workstreams`, "POST", {
      title: addState.title,
      objective: addState.objective,
      reason_required: addState.reason_required,
      proposed_actions: splitLines(addState.proposed_actions),
      execution_steps: splitLines(addState.execution_steps),
      proposed_worker: addState.proposed_worker,
      proposed_tools: splitComma(addState.proposed_tools),
      inputs: splitLines(addState.inputs),
      expected_output: splitLines(addState.expected_output).length
        ? splitLines(addState.expected_output)
        : ["deliverable"],
      evidence_requirements: splitLines(addState.evidence_requirements),
      dependencies: splitComma(addState.dependencies),
      acceptance_criteria: splitLines(addState.acceptance_criteria).length
        ? splitLines(addState.acceptance_criteria)
        : ["Deliverable produced"],
      required_capabilities: ["docs"],
      risk_level: addState.risk_level,
      approval_required: addState.approval_required,
      parallelizable: addState.parallelizable,
      human_gate_required: addState.human_gate_required,
      authority_level: addState.authority_level,
      recovery_strategy: addState.recovery_strategy,
      owner_notes: addState.owner_notes,
    });
    if (ok) setAddState(null);
  }

  async function approveAll() {
    await callApi(`${base}/approve-all`, "POST");
  }

  async function regenerate() {
    if (
      !confirm(
        "Regenerate plan? The current workstreams will be replaced with a fresh decomposition.",
      )
    )
      return;
    await callApi(`${base}/regenerate`, "POST");
  }

  async function answerQuestion(q: OwnerQuestion, answer: string) {
    await callApi(`${base}/questions/${q.id}`, "PATCH", { answer });
  }

  if (loading)
    return (
      <div className="panel" style={{ padding: "2rem", textAlign: "center" }}>
        <p style={{ color: "var(--ink-muted)" }}>Generating mission plan…</p>
      </div>
    );

  if (error)
    return (
      <div
        className="panel"
        style={{ padding: "1.5rem", display: "flex", flexDirection: "column", gap: "0.75rem" }}
      >
        <p style={{ color: "var(--danger)" }}>{error}</p>
        <button
          className="btn btn-secondary"
          style={{ alignSelf: "flex-start" }}
          onClick={fetchPlan}
        >
          Retry
        </button>
      </div>
    );

  if (!plan) return null;

  const isBusy = saving !== null;
  const allDispatchable = plan.workstreams.every((ws) => ws.approval_state === "DISPATCHABLE");
  const pendingCount = plan.workstreams.filter((ws) => ws.approval_state === "PROPOSED").length;
  const sortedWs = [...plan.workstreams].sort((a, b) => a.execution_order - b.execution_order);

  return (
    <>
      <div
        style={{
          maxWidth: "860px",
          margin: "0 auto",
          padding: "1.5rem 1rem 6rem",
          display: "flex",
          flexDirection: "column",
          gap: "1.5rem",
        }}
      >
        {/* Breadcrumb + header */}
        <div>
          <nav
            style={{
              fontSize: "0.82rem",
              color: "var(--ink-muted)",
              display: "flex",
              gap: "0.4rem",
              flexWrap: "wrap",
              marginBottom: "0.5rem",
            }}
          >
            <Link
              href="/intake"
              style={{ textDecoration: "underline", textUnderlineOffset: "2px" }}
            >
              Intake
            </Link>
            <span>›</span>
            <Link
              href={`/intake/${missionId}`}
              style={{ textDecoration: "underline", textUnderlineOffset: "2px" }}
            >
              {missionId}
            </Link>
            <span>›</span>
            <span>Plan Review</span>
          </nav>
          <h1 style={{ fontSize: "1.6rem", fontWeight: 700, marginBottom: "0.2rem" }}>
            Mission Plan Review
          </h1>
          <p style={{ fontSize: "0.85rem", color: "var(--ink-muted)" }}>
            Review and approve all workstreams before dispatch. Dispatch is blocked until every
            workstream reaches <strong>Dispatchable</strong>.
          </p>
        </div>

        {/* Lock conflict banner */}
        {lockConflict && (
          <div
            role="alert"
            style={{
              background: "#fef3c7",
              border: "1px solid #fbbf24",
              borderRadius: "8px",
              padding: "0.85rem 1.1rem",
              display: "flex",
              flexDirection: "column",
              gap: "0.4rem",
            }}
          >
            <strong style={{ fontSize: "0.9rem", color: "#78350f" }}>
              Edit blocked — workstream already open
            </strong>
            <p style={{ margin: 0, fontSize: "0.85rem", color: "#92400e" }}>
              <strong>{lockConflict.wsTitle}</strong> is being edited by{" "}
              <strong>{lockConflict.actor}</strong> in another session. Close that session or wait
              for them to finish before editing here.
            </p>
            <div style={{ display: "flex", gap: "0.6rem", flexWrap: "wrap", marginTop: "0.2rem" }}>
              <a
                href={lockConflict.planUrl}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  fontSize: "0.82rem",
                  color: "#1d4ed8",
                  textDecoration: "underline",
                  textUnderlineOffset: "2px",
                }}
              >
                Go to primary session →
              </a>
              <button
                className="btn btn-secondary"
                style={{ fontSize: "0.78rem", padding: "0.3rem 0.6rem" }}
                onClick={() => setLockConflict(null)}
              >
                Dismiss
              </button>
            </div>
            <p style={{ margin: 0, fontSize: "0.72rem", color: "#b45309", opacity: 0.8 }}>
              Note: this only detects sessions tracked by this server. External AI sessions cannot
              be detected.
            </p>
          </div>
        )}

        {/* Mission summary */}
        <MissionSummary plan={plan} />

        {/* Workstream section */}
        <section>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              flexWrap: "wrap",
              gap: "0.5rem",
              marginBottom: "0.75rem",
            }}
          >
            <h2 style={{ fontSize: "1.1rem", fontWeight: 700 }}>
              Workstreams{" "}
              <span
                style={{
                  fontFamily: "var(--font-mono), monospace",
                  fontWeight: 400,
                  fontSize: "0.9rem",
                  color: "var(--ink-muted)",
                }}
              >
                ({plan.workstreams.length})
              </span>
            </h2>
            <button
              className="btn btn-secondary"
              style={{ fontSize: "0.82rem", padding: "0.45rem 0.8rem" }}
              disabled={isBusy}
              onClick={() => setAddState(emptyAdd())}
            >
              + Add Workstream
            </button>
          </div>

          {pendingCount > 0 && !allDispatchable && (
            <div
              style={{
                background: "#fffbeb",
                border: "1px solid #fcd34d",
                borderRadius: "8px",
                padding: "0.65rem 0.9rem",
                fontSize: "0.85rem",
                color: "#78350f",
                marginBottom: "0.75rem",
                display: "flex",
                alignItems: "center",
                gap: "0.5rem",
              }}
            >
              <span>⚠</span>
              <span>
                {pendingCount} workstream{pendingCount > 1 ? "s" : ""} awaiting approval. Approve
                each or use <strong>Approve All</strong>. Dispatch remains blocked until all reach{" "}
                <strong>Dispatchable</strong>.
              </span>
            </div>
          )}

          <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
            {sortedWs.map((ws) => (
              <WorkstreamCard
                key={ws.workstream_id}
                ws={ws}
                allWs={plan.workstreams}
                isBusy={isBusy}
                onApprove={() => approveWorkstream(ws.workstream_id)}
                onEdit={() => startEdit(ws)}
                onRemove={() => removeWorkstream(ws.workstream_id, ws.title)}
                canRemove={plan.workstreams.length > 1}
              />
            ))}
          </div>
        </section>

        {/* Owner questions */}
        <section>
          <h2
            style={{
              fontSize: "1.1rem",
              fontWeight: 700,
              marginBottom: "0.35rem",
            }}
          >
            Owner Questions
          </h2>
          <p style={{ fontSize: "0.85rem", color: "var(--ink-muted)", marginBottom: "0.75rem" }}>
            Answer required questions (*) before approving the plan. Answers are saved automatically
            on blur.
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.6rem" }}>
            {plan.owner_questions.map((q) => (
              <div
                key={q.id}
                className="panel"
                style={{
                  padding: "0.85rem 1rem",
                  display: "flex",
                  flexDirection: "column",
                  gap: "0.5rem",
                }}
              >
                <p style={{ fontSize: "0.875rem", fontWeight: 600 }}>
                  {q.question}
                  {q.required && (
                    <span style={{ color: "var(--danger)", marginLeft: "0.25rem" }}>*</span>
                  )}
                </p>
                <textarea
                  style={{
                    border: "1px solid var(--border)",
                    borderRadius: "8px",
                    padding: "0.6rem 0.75rem",
                    font: "inherit",
                    fontSize: "0.875rem",
                    minHeight: "60px",
                    resize: "vertical",
                    background: "#fcfdfc",
                  }}
                  placeholder="Your answer…"
                  defaultValue={q.answer ?? ""}
                  onBlur={(e) => {
                    const val = e.target.value.trim();
                    if (val !== (q.answer ?? "")) answerQuestion(q, val);
                  }}
                />
              </div>
            ))}
          </div>
        </section>
      </div>

      {/* Sticky bottom action bar */}
      <div className="sticky-actions">
        <button
          className="btn btn-secondary"
          style={{ fontSize: "0.875rem" }}
          disabled={isBusy}
          onClick={regenerate}
        >
          ↺ Regenerate Plan
        </button>

        {!allDispatchable && (
          <button
            className="btn btn-primary"
            style={{ fontSize: "0.875rem" }}
            disabled={isBusy}
            onClick={approveAll}
          >
            Approve All ({pendingCount} pending)
          </button>
        )}

        {allDispatchable && (
          <button
            className="btn btn-primary"
            style={{ fontSize: "0.875rem" }}
            onClick={() => router.push(`/intake/${missionId}`)}
          >
            Proceed to Dispatch ›
          </button>
        )}

        {saving && (
          <span style={{ fontSize: "0.8rem", color: "var(--ink-muted)", alignSelf: "center" }}>
            Saving…
          </span>
        )}
      </div>

      {/* Edit modal */}
      {editState && (
        <EditModal
          state={editState}
          allWs={plan.workstreams}
          isBusy={isBusy}
          onChange={(patch) => setEditState((s) => (s ? { ...s, ...patch } : s))}
          onSubmit={submitEdit}
          onCancel={cancelEdit}
        />
      )}

      {/* Add modal */}
      {addState && (
        <AddModal
          state={addState}
          allWs={plan.workstreams}
          isBusy={isBusy}
          onChange={(patch) => setAddState((s) => (s ? { ...s, ...patch } : s))}
          onSubmit={submitAdd}
          onCancel={() => setAddState(null)}
        />
      )}
    </>
  );
}
