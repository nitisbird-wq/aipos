"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { SyncBadge } from "@/components/SyncBadge";

type MissionRow = {
  mission_id: string;
  title?: string;
  mission_summary?: string;
  status: string;
  planning_status: string;
  operational_risk?: string;
  sensitivity_flags?: string[];
  deadline?: string | null;
  current_blockers?: unknown[];
  notion_sync?: {
    sync_status: string;
    notion_page_id: string | null;
  } | null;
};

export default function MissionsPage() {
  const router = useRouter();
  const [missions, setMissions] = useState<MissionRow[]>([]);
  const [mode, setMode] = useState<string>("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/missions")
      .then(async (res) => {
        const data = await res.json();
        if (res.status === 401) {
          router.push("/login");
          return;
        }
        if (!res.ok) {
          setError(data?.error?.message || "Failed to load");
          return;
        }
        setMissions(data.missions || []);
        setMode(data.persistence_mode || "");
      })
      .catch(() => setError("Network error"));
  }, [router]);

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-3xl font-bold md:text-4xl">Mission Dashboard</h1>
          <p className="mt-2 text-[var(--ink-muted)]">
            Runtime missions from App DB. Notion badge reflects verified sync only.
          </p>
        </div>
        <Link href="/intake" className="btn btn-primary">
          New Mission
        </Link>
      </div>

      {mode === "dev-file" && (
        <p className="panel badge-pending p-3 text-sm">
          Persistence: <strong>development file adapter</strong> (DATABASE_URL unavailable or not
          forced). Postgres/Neon schema is ready under <code>drizzle/</code>.
        </p>
      )}
      {error && <p className="text-[var(--danger)]">{error}</p>}

      <div className="panel table-wrap p-2 md:p-4">
        <table className="data">
          <thead>
            <tr>
              <th>Mission</th>
              <th>Status</th>
              <th className="hide-mobile">Planning</th>
              <th>Risk</th>
              <th className="hide-mobile">Sensitivity</th>
              <th>Notion</th>
            </tr>
          </thead>
          <tbody>
            {missions.length === 0 ? (
              <tr>
                <td colSpan={6} className="text-[var(--ink-muted)]">
                  No missions yet. Start an intake.
                </td>
              </tr>
            ) : (
              missions.map((m) => (
                <tr key={m.mission_id}>
                  <td>
                    <Link
                      className="font-semibold text-[var(--accent)]"
                      href={`/missions/${m.mission_id}`}
                    >
                      {m.mission_id}
                    </Link>
                    <div className="text-sm text-[var(--ink-muted)]">
                      {m.title || m.mission_summary || "—"}
                    </div>
                  </td>
                  <td>{m.status}</td>
                  <td className="hide-mobile">{m.planning_status}</td>
                  <td>{m.operational_risk || "—"}</td>
                  <td className="hide-mobile">{(m.sensitivity_flags || []).join(", ") || "—"}</td>
                  <td>
                    <SyncBadge
                      status={m.notion_sync?.sync_status}
                      pageId={m.notion_sync?.notion_page_id}
                    />
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
