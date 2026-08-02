export type NotionWriteResult =
  | {
      ok: true;
      /** Real external Notion page/record ID — only set for verified production sync */
      notion_page_id: string;
      verified: true;
      adapter: "notion-sdk";
    }
  | {
      ok: true;
      /** Mock-only local id — never treat as external verified sync */
      mock_record_id: string;
      verified: false;
      mock: true;
      adapter: "mock";
    }
  | {
      ok: false;
      error: string;
      verified: false;
      adapter: "mock" | "notion-sdk";
    };

export type NotionPageTarget = {
  mission_id: string;
  /** Existing page id from App DB — MUST reuse; never create a second page (C-03). */
  notion_page_id?: string | null;
};

export interface NotionIntegration {
  readonly adapterName: "mock" | "notion-sdk";
  createOrUpdateMissionPage(mission: NotionPageTarget): Promise<NotionWriteResult>;
}

/**
 * Mock Notion adapter — does not perform real Notion writes.
 * Never returns verified=true. Callers must store sync_status=mock_synced.
 * mock_record_id is stable per mission_id (idempotent).
 */
export class MockNotionAdapter implements NotionIntegration {
  readonly adapterName = "mock" as const;

  async createOrUpdateMissionPage(mission: NotionPageTarget): Promise<NotionWriteResult> {
    if (process.env.NOTION_MOCK_SUCCESS === "false") {
      return {
        ok: false,
        error: "Mock Notion failure (NOTION_MOCK_SUCCESS=false)",
        verified: false,
        adapter: "mock",
      };
    }
    return {
      ok: true,
      mock_record_id: `mock-page-${mission.mission_id}`,
      verified: false,
      mock: true,
      adapter: "mock",
    };
  }
}

/**
 * Real SDK path placeholder — never claims success without verified page id.
 * When notion_page_id is present, future real writes MUST update that page.
 */
export class NotionSdkAdapter implements NotionIntegration {
  readonly adapterName = "notion-sdk" as const;

  async createOrUpdateMissionPage(mission: NotionPageTarget): Promise<NotionWriteResult> {
    void mission.notion_page_id;
    const token = process.env.NOTION_TOKEN?.trim();
    const db = process.env.NOTION_MISSIONS_DATABASE_ID?.trim();
    if (!token || !db) {
      return {
        ok: false,
        error: "NOTION_TOKEN or NOTION_MISSIONS_DATABASE_ID missing",
        verified: false,
        adapter: "notion-sdk",
      };
    }
    return {
      ok: false,
      error: "Real Notion writes are disabled in Intake MVP v0.1. Use NOTION_ADAPTER=mock.",
      verified: false,
      adapter: "notion-sdk",
    };
  }
}

export function getNotionAdapter(): NotionIntegration {
  const mode = (process.env.NOTION_ADAPTER || "mock").toLowerCase();
  if (mode === "notion-sdk" || mode === "real") {
    return new NotionSdkAdapter();
  }
  return new MockNotionAdapter();
}

export function isVerifiedNotionResult(
  result: NotionWriteResult,
): result is Extract<NotionWriteResult, { verified: true }> {
  return result.ok === true && result.verified === true && "notion_page_id" in result;
}
