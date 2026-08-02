"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type Policy = {
  policy_id: string;
  version: string;
  name: string;
  description: string;
  severity: string;
  enabled: boolean;
  action_on_violation: string;
  rule_key: string;
};

export default function GovernancePage() {
  const router = useRouter();
  const [policies, setPolicies] = useState<Policy[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/policies")
      .then(async (res) => {
        const data = await res.json();
        if (res.status === 401) {
          router.push("/login");
          return;
        }
        if (!res.ok) {
          setError(data?.error?.message || "Failed to load policies");
          return;
        }
        setPolicies(data.policies || []);
      })
      .catch(() => setError("Network error"));
  }, [router]);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-3xl font-bold md:text-4xl">Governance</h1>
        <p className="mt-2 text-[var(--ink-muted)]">
          Read-only Policy Registry loaded from <code>data/seeds/policies.json</code>. No admin
          editor in v0.1.
        </p>
      </div>
      {error && <p className="text-[var(--danger)]">{error}</p>}
      <div className="panel table-wrap p-2 md:p-4">
        <table className="data">
          <thead>
            <tr>
              <th>Policy</th>
              <th>Version</th>
              <th>Severity</th>
              <th>Enforcement</th>
              <th>Enabled</th>
            </tr>
          </thead>
          <tbody>
            {policies.map((p) => (
              <tr key={`${p.policy_id}-${p.version}`}>
                <td>
                  <div className="font-semibold">{p.policy_id}</div>
                  <div className="text-sm">{p.name}</div>
                  <div className="text-xs text-[var(--ink-muted)]">{p.description}</div>
                  <div className="font-mono text-xs text-[var(--ink-muted)]">{p.rule_key}</div>
                </td>
                <td>{p.version}</td>
                <td>{p.severity}</td>
                <td>{p.action_on_violation}</td>
                <td>{p.enabled ? "yes" : "no"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
