import type { NotionSyncRecord, NotionSyncStatus, VerificationMethod } from "@/lib/schemas/mission";
import type { MissionObject } from "@/lib/schemas/mission";
import { getRepository } from "@/lib/repositories";
import {
  getNotionAdapter,
  isVerifiedNotionResult,
  type NotionWriteResult,
} from "@/lib/notion/client";
import {
  newAuditId,
  newCorrelationId,
  newPolicyDecisionId,
  newSyncAttemptId,
  nowIso,
} from "@/lib/ids";

export type SyncOutcome = {
  sync_status: NotionSyncStatus;
  notion_page_id: string | null;
  mock_record_id?: string | null;
  error?: string;
  message: string;
  source_record_version?: string | null;
};

const VERIFICATION_VERSION = "1.0";

function emptyVerification(): Pick<
  NotionSyncRecord,
  | "verified_by"
  | "verified_at"
  | "verification_method"
  | "verification_version"
  | "source_record_version"
  | "policy_decision_id"
  | "sync_attempt_id"
> {
  return {
    sync_attempt_id: null,
    verified_by: null,
    verified_at: null,
    verification_method: null,
    verification_version: null,
    source_record_version: null,
    policy_decision_id: null,
  };
}

export function applyNotionWriteResult(
  missionId: string,
  result: NotionWriteResult,
  base: Partial<NotionSyncRecord> = {},
  now = nowIso(),
): NotionSyncRecord & { message: string; mock_record_id?: string | null } {
  const reusedPageId = base.notion_page_id ?? null;

  if (isVerifiedNotionResult(result)) {
    return {
      mission_id: missionId,
      notion_page_id: result.notion_page_id || reusedPageId,
      sync_status: "synced",
      sync_attempt_id: base.sync_attempt_id ?? null,
      verified_by: base.verified_by ?? null,
      verified_at: base.verified_at ?? null,
      verification_method: base.verification_method ?? null,
      verification_version: base.verification_version ?? null,
      source_record_version: base.source_record_version ?? null,
      policy_decision_id: base.policy_decision_id ?? null,
      last_error: null,
      synced_at: now,
      updated_at: now,
      message: "Notion verified",
      mock_record_id: null,
    };
  }

  if (result.ok && "mock" in result && result.mock) {
    return {
      mission_id: missionId,
      // mock never claims external page id; keep prior verified page for reuse after real adapter
      notion_page_id: reusedPageId,
      sync_status: "mock_synced",
      sync_attempt_id: base.sync_attempt_id ?? null,
      verified_by: base.verified_by ?? null,
      verified_at: base.verified_at ?? null,
      verification_method: base.verification_method ?? null,
      verification_version: base.verification_version ?? null,
      source_record_version: base.source_record_version ?? null,
      policy_decision_id: base.policy_decision_id ?? null,
      last_error: null,
      synced_at: now,
      updated_at: now,
      message: "Mock sync only — no external Notion record was created.",
      mock_record_id: result.mock_record_id,
    };
  }

  return {
    mission_id: missionId,
    notion_page_id: reusedPageId,
    sync_status: "failed",
    sync_attempt_id: base.sync_attempt_id ?? null,
    verified_by: base.verified_by ?? null,
    verified_at: base.verified_at ?? null,
    verification_method: base.verification_method ?? null,
    verification_version: base.verification_version ?? null,
    source_record_version: base.source_record_version ?? null,
    policy_decision_id: base.policy_decision_id ?? null,
    last_error: result.ok ? "Missing verified page id" : result.error,
    synced_at: null,
    updated_at: now,
    message: result.ok ? "Missing verified page id" : result.error,
    mock_record_id: null,
  };
}

/**
 * When mission revision diverges from verified source_record_version,
 * invalidate verification and set sync to pending (or conflict if page exists).
 * Preserves notion_page_id for idempotent update (C-03).
 */
export async function invalidateNotionVerificationIfStale(
  mission: MissionObject,
): Promise<NotionSyncRecord | null> {
  const repo = getRepository();
  const existing = await repo.getNotionSync(mission.mission_id);
  if (!existing) return null;

  const currentVersion = String(mission.revision);
  if (!existing.source_record_version || existing.source_record_version === currentVersion) {
    return existing;
  }

  const now = nowIso();
  const invalidated: NotionSyncRecord = {
    ...existing,
    ...emptyVerification(),
    notion_page_id: existing.notion_page_id,
    sync_status: existing.notion_page_id ? "conflict" : "pending",
    last_error: `Verification invalidated: source_record_version ${existing.source_record_version} != mission revision ${currentVersion}`,
    synced_at: null,
    updated_at: now,
  };
  await repo.saveNotionSync(invalidated);
  await repo.appendAudit({
    id: newAuditId(),
    aggregate_type: "notion_sync",
    mission_id: mission.mission_id,
    intake_id: mission.source_intake_id,
    actor: "system:aipos_core",
    action: "notion:verification_invalidated",
    reason: invalidated.last_error || "source version changed",
    correlation_id: newCorrelationId(),
    causation_id: null,
    previous_state: existing.sync_status,
    new_state: invalidated.sync_status,
    policy_result: {
      decision: "block",
      policy_ref: "AIPOS-GOV-005",
      previous_source_record_version: existing.source_record_version,
      current_revision: currentVersion,
    },
    created_at: now,
  });
  return invalidated;
}

export type RetryNotionResult =
  | { ok: true; notion: SyncOutcome }
  | {
      ok: false;
      code: "RETRY_NOT_ALLOWED" | "MISSION_NOT_FOUND";
      message: string;
      sync_status?: NotionSyncStatus;
    };

/**
 * Retry Notion sync — allowed only when sync_status = failed,
 * unless force=true for authorized diagnostic action.
 * Always reuses existing notion_page_id when present.
 */
export async function retryNotionSync(params: {
  missionId: string;
  actor: string;
  force?: boolean;
  correlation_id?: string;
  causation_id?: string;
}): Promise<RetryNotionResult> {
  const repo = getRepository();
  const mission = await repo.getMissionById(params.missionId);
  if (!mission) {
    return { ok: false, code: "MISSION_NOT_FOUND", message: "Mission not found" };
  }

  const existing = await repo.getNotionSync(params.missionId);
  const currentStatus = existing?.sync_status ?? "not_started";

  if (currentStatus !== "failed" && !params.force) {
    return {
      ok: false,
      code: "RETRY_NOT_ALLOWED",
      message: `Retry is only allowed when sync_status=failed (current=${currentStatus})`,
      sync_status: currentStatus,
    };
  }

  const previousFailed = currentStatus === "failed";
  const method: VerificationMethod = params.force ? "diagnostic_force" : "manual_retry";
  const notion = await projectMissionToNotion({
    mission,
    actor: params.actor,
    correlation_id: params.correlation_id || newCorrelationId(),
    causation_id: params.causation_id,
    verification_method: method,
    policy_decision_id: existing?.policy_decision_id || newPolicyDecisionId("RETRY"),
  });

  if (previousFailed && (notion.sync_status === "synced" || notion.sync_status === "mock_synced")) {
    await repo.appendAudit({
      id: newAuditId(),
      aggregate_type: "notion_sync",
      mission_id: params.missionId,
      intake_id: mission.source_intake_id,
      actor: params.actor,
      action: notion.sync_status === "synced" ? "notion:retry_success" : "notion:retry_mock_synced",
      reason:
        notion.sync_status === "synced"
          ? "Verified Notion retry after failure"
          : "Mock sync retry after failure — no external Notion record",
      correlation_id: params.correlation_id || newCorrelationId(),
      causation_id: params.causation_id ?? null,
      previous_state: "failed",
      new_state: notion.sync_status,
      policy_result: {
        decision: "allow",
        policy_ref: "AIPOS-GOV-005",
        verified: notion.sync_status === "synced",
        notion_page_id: notion.notion_page_id,
        mock_record_id: notion.mock_record_id ?? null,
        forced: Boolean(params.force),
      },
      created_at: nowIso(),
    });
  } else if (previousFailed && notion.sync_status === "failed") {
    await repo.appendAudit({
      id: newAuditId(),
      aggregate_type: "notion_sync",
      mission_id: params.missionId,
      intake_id: mission.source_intake_id,
      actor: params.actor,
      action: "notion:retry_failed",
      reason: notion.error || "Retry failed",
      correlation_id: params.correlation_id || newCorrelationId(),
      causation_id: params.causation_id ?? null,
      previous_state: "failed",
      new_state: "failed",
      policy_result: {
        decision: "block",
        policy_ref: "AIPOS-GOV-005",
        verified: false,
      },
      created_at: nowIso(),
    });
  }

  return { ok: true, notion };
}

async function projectMissionToNotion(params: {
  mission: MissionObject;
  actor: string;
  correlation_id: string;
  causation_id?: string;
  verification_method: VerificationMethod;
  policy_decision_id: string;
  writeAudit?: boolean;
}): Promise<SyncOutcome> {
  const repo = getRepository();
  const notion = getNotionAdapter();
  const now = nowIso();
  const existing = await repo.getNotionSync(params.mission.mission_id);
  const sync_attempt_id = newSyncAttemptId();
  const source_record_version = String(params.mission.revision);

  const pending: NotionSyncRecord = {
    mission_id: params.mission.mission_id,
    notion_page_id: existing?.notion_page_id ?? null,
    sync_status: "pending",
    sync_attempt_id,
    verified_by: params.actor,
    verified_at: now,
    verification_method: params.verification_method,
    verification_version: VERIFICATION_VERSION,
    source_record_version,
    policy_decision_id: params.policy_decision_id,
    last_error: null,
    synced_at: null,
    updated_at: now,
  };
  await repo.saveNotionSync(pending);

  const result = await notion.createOrUpdateMissionPage({
    mission_id: params.mission.mission_id,
    notion_page_id: pending.notion_page_id,
  });

  const applied = applyNotionWriteResult(params.mission.mission_id, result, pending, nowIso());
  const { message, mock_record_id, ...record } = applied;
  await repo.saveNotionSync(record);

  if (params.writeAudit !== false) {
    await repo.appendAudit({
      id: newAuditId(),
      aggregate_type: "notion_sync",
      mission_id: params.mission.mission_id,
      intake_id: params.mission.source_intake_id,
      actor: params.actor,
      action:
        record.sync_status === "synced"
          ? "notion:sync"
          : record.sync_status === "mock_synced"
            ? "notion:mock_sync"
            : "notion:sync_failed",
      reason: message,
      correlation_id: params.correlation_id,
      causation_id: params.causation_id ?? null,
      previous_state: "pending",
      new_state: record.sync_status,
      policy_result: {
        decision: record.sync_status === "failed" ? "block" : "allow",
        policy_ref: "AIPOS-GOV-005",
        policy_decision_id: params.policy_decision_id,
        adapter: notion.adapterName,
        verified: record.sync_status === "synced",
        notion_page_id: record.notion_page_id,
        mock_record_id: mock_record_id ?? null,
        source_record_version,
        sync_attempt_id,
      },
      created_at: nowIso(),
    });
  }

  return {
    sync_status: record.sync_status,
    notion_page_id: record.notion_page_id,
    mock_record_id: mock_record_id ?? null,
    error: record.last_error ?? undefined,
    message,
    source_record_version,
  };
}

export async function syncMissionToNotion(
  mission: MissionObject,
  actor: string,
  correlation_id: string,
  opts?: {
    causation_id?: string;
    policy_decision_id?: string;
    verification_method?: VerificationMethod;
  },
): Promise<SyncOutcome> {
  return projectMissionToNotion({
    mission,
    actor,
    correlation_id,
    causation_id: opts?.causation_id,
    verification_method: opts?.verification_method ?? "user_confirm_mapping",
    policy_decision_id: opts?.policy_decision_id ?? newPolicyDecisionId("MAP"),
    writeAudit: true,
  });
}
