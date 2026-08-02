"use client";

import { useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";

/**
 * Legacy understanding route — Chat-first Mission Commander is primary.
 * Kept for deep links; redirects operators toward /intake with context note.
 */
export default function UnderstandingPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const id = params.id;

  useEffect(() => {
    // Prefer chat-first; keep page reachable briefly with guidance
  }, [id]);

  return (
    <div className="panel space-y-4 p-6">
      <h1 className="text-2xl font-bold">Mission Understanding (legacy view)</h1>
      <p className="text-[var(--ink-muted)]">
        Primary intake is now Chat-first via Mission Commander. Structured understanding remains
        available through the conversation draft panel and Advanced mission details.
      </p>
      <p className="text-sm">
        Intake ID: <code>{id}</code>
      </p>
      <div className="flex flex-wrap gap-2">
        <Link className="btn btn-primary" href="/intake">
          Open Mission Commander
        </Link>
        <button
          type="button"
          className="btn btn-secondary"
          onClick={() => router.push(`/missions`)}
        >
          Missions
        </button>
      </div>
    </div>
  );
}
