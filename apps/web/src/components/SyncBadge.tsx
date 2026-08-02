export function SyncBadge({ status, pageId }: { status?: string | null; pageId?: string | null }) {
  const looksMock =
    status === "mock_synced" || (typeof pageId === "string" && pageId.startsWith("mock-"));

  if (looksMock) {
    return (
      <span
        className="badge badge-mock"
        title="Mock sync only — no external Notion record was created."
      >
        Mock sync only
      </span>
    );
  }

  // Reserved for real API response with a valid external page/record ID
  if (status === "synced" && pageId) {
    return <span className="badge badge-verified">Notion verified</span>;
  }
  if (status === "failed") {
    return <span className="badge badge-failed">Notion failed</span>;
  }
  if (status === "pending") {
    return <span className="badge badge-pending">Notion pending</span>;
  }
  if (status === "conflict") {
    return <span className="badge badge-failed">Notion conflict</span>;
  }
  if (status === "not_started") {
    return <span className="badge">Notion not started</span>;
  }
  return <span className="badge">Notion unknown</span>;
}

export function SyncStatusMessage({
  status,
  pageId,
  mockRecordId,
  message,
}: {
  status?: string | null;
  pageId?: string | null;
  mockRecordId?: string | null;
  message?: string | null;
}) {
  if (status === "synced" && pageId) {
    return (
      <p className="text-sm text-[var(--ok)]">
        Notion verified — external page/record ID: <code>{pageId}</code>
      </p>
    );
  }
  if (status === "mock_synced" || (typeof pageId === "string" && pageId.startsWith("mock-"))) {
    return (
      <p className="text-sm text-[var(--warn)]">
        Mock sync only — no external Notion record was created.
        {mockRecordId ? (
          <>
            {" "}
            Local mock id: <code>{mockRecordId}</code>
          </>
        ) : null}
      </p>
    );
  }
  if (status === "failed") {
    return <p className="text-sm text-[var(--danger)]">{message || "Notion sync failed."}</p>;
  }
  return null;
}
