import { getRepository } from "@/lib/repositories";
import { assertOperatorActor, newAuditId, newCorrelationId, nowIso } from "@/lib/ids";
import {
  ArtifactQaEvidenceSchema,
  StageArtifactSnapshotSchema,
  type ArtifactQaEvidence,
  type StageArtifactSnapshot,
} from "@/lib/schemas/stage-artifact";
import { getLatestMissionBlueprint } from "@/lib/services/mission-blueprint";
import {
  getMissionControlState,
  upsertMissionControlState,
} from "@/lib/services/control-plane-state";

const ARTIFACT_ACTION = "stage_artifact:snapshot";

// prettier-ignore
function artifactFromEvent(event: { action: string; policy_result: unknown }) {
  if (event.action !== ARTIFACT_ACTION) return null;
  const row = (event.policy_result as { stage_artifact?: unknown }).stage_artifact;
  return row ? StageArtifactSnapshotSchema.parse(row) : null;
}

export function requiredArtifactQaChecks(kind: string): string[] {
  const normalized = kind.trim().toLowerCase();
  if (normalized.includes("spreadsheet")) return ["formula_integrity", "data_validation"];
  if (normalized.includes("presentation") || normalized.includes("deck")) {
    return ["render_integrity", "slide_overflow"];
  }
  if (normalized.includes("document") || normalized.includes("pdf")) {
    return ["render_integrity", "content_completeness"];
  }
  return ["artifact_accessibility"];
}

// prettier-ignore
export async function listStageArtifactSnapshots(
  missionId: string,
  stageId?: string,
): Promise<StageArtifactSnapshot[]> {
  const mission = await getRepository().getMissionById(missionId);
  if (!mission) throw new Error("MISSION_NOT_FOUND");
  const audit = await getRepository().listAudit({ mission_id: missionId });
  return audit
    .map(artifactFromEvent)
    .filter((row): row is StageArtifactSnapshot => Boolean(row))
    .filter((row) => (stageId ? row.stage_id === stageId : true))
    .sort((a, b) => b.revision - a.revision || b.created_at.localeCompare(a.created_at));
}

export async function getLatestStageArtifact(missionId: string, stageId: string) {
  return (await listStageArtifactSnapshots(missionId, stageId))[0] ?? null;
}

// prettier-ignore
function verifyFinalSnapshot(input: {
  kind: string;
  final_uri: string | null;
  preview_uri: string | null;
  qa_evidence: ArtifactQaEvidence[];
}) {
  if (!input.final_uri) throw new Error("FINAL_ARTIFACT_URI_REQUIRED");
  if (!input.preview_uri) throw new Error("ARTIFACT_PREVIEW_REQUIRED");
  const required = requiredArtifactQaChecks(input.kind);
  const passing = new Set(
    input.qa_evidence.filter((evidence) => evidence.status === "PASS").map((evidence) => evidence.check),
  );
  if (input.qa_evidence.some((evidence) => evidence.status === "FAIL")) {
    throw new Error("ARTIFACT_QA_FAILED");
  }
  if (required.some((check) => !passing.has(check))) {
    throw new Error("ARTIFACT_QA_EVIDENCE_INCOMPLETE");
  }
}

// prettier-ignore
async function persistSnapshot(input: {
  missionId: string;
  stageId: string;
  actor: string;
  status: StageArtifactSnapshot["status"];
  kind: string;
  editable_uri: string;
  final_uri: string | null;
  preview_uri: string | null;
  checksum: string;
  qa_evidence: ArtifactQaEvidence[];
  rollback_of_revision?: number | null;
}): Promise<StageArtifactSnapshot> {
  assertOperatorActor(input.actor);
  const repo = getRepository();
  const mission = await repo.getMissionById(input.missionId);
  if (!mission) throw new Error("MISSION_NOT_FOUND");
  const blueprint = await getLatestMissionBlueprint(input.missionId);
  if (!blueprint?.stages.some((stage) => stage.stage_id === input.stageId)) {
    throw new Error("BLUEPRINT_STAGE_NOT_FOUND");
  }
  const previous = await getLatestStageArtifact(input.missionId, input.stageId);
  const revision = (previous?.revision ?? 0) + 1;
  const qaEvidence = input.qa_evidence.map((row) => ArtifactQaEvidenceSchema.parse(row));
  if (["FINAL", "ROLLED_BACK"].includes(input.status)) {
    verifyFinalSnapshot({ ...input, qa_evidence: qaEvidence });
  }
  const createdAt = nowIso();
  const snapshot = StageArtifactSnapshotSchema.parse({
    artifact_version: "stage-artifact.v1",
    artifact_id: `ART-${input.missionId}-${input.stageId}`,
    mission_id: input.missionId,
    stage_id: input.stageId,
    revision,
    status: input.status,
    kind: input.kind,
    editable_uri: input.editable_uri,
    final_uri: input.final_uri,
    preview_uri: input.preview_uri,
    checksum: input.checksum,
    qa_evidence: qaEvidence,
    parent_revision: previous?.revision ?? null,
    rollback_of_revision: input.rollback_of_revision ?? null,
    created_at: createdAt,
    created_by: input.actor,
  });

  await repo.appendAudit({
    id: newAuditId(),
    aggregate_type: "mission",
    mission_id: input.missionId,
    intake_id: mission.source_intake_id,
    actor: input.actor,
    action: ARTIFACT_ACTION,
    reason: `Stage artifact ${input.stageId} revision ${revision}: ${input.status}`,
    correlation_id: newCorrelationId(),
    causation_id: null,
    previous_state: previous?.status ?? null,
    new_state: input.status,
    policy_result: { decision: "allow", stage_artifact: snapshot },
    created_at: createdAt,
  });

  if (["FINAL", "ROLLED_BACK"].includes(snapshot.status)) {
    const state = await getMissionControlState(input.missionId);
    const artifacts = [
      ...state.artifacts.filter(
        (artifact) =>
          !(
            artifact.workstream_id === input.stageId &&
            artifact.artifact_id === snapshot.artifact_id
          ),
      ),
      {
        mission_id: input.missionId,
        workstream_id: input.stageId,
        artifact_id: snapshot.artifact_id,
        uri: snapshot.final_uri!,
        kind: snapshot.kind,
        created_at: snapshot.created_at,
      },
    ];
    await upsertMissionControlState(input.missionId, input.actor, { artifacts });
  }
  return snapshot;
}

export async function saveStageArtifactSnapshot(input: {
  missionId: string;
  stageId: string;
  actor: string;
  status: "DRAFT" | "FINAL";
  kind: string;
  editable_uri: string;
  final_uri?: string | null;
  preview_uri?: string | null;
  checksum: string;
  qa_evidence: ArtifactQaEvidence[];
}) {
  return persistSnapshot({
    ...input,
    final_uri: input.final_uri ?? null,
    preview_uri: input.preview_uri ?? null,
  });
}

// prettier-ignore
export async function rollbackStageArtifact(input: {
  missionId: string;
  stageId: string;
  targetRevision: number;
  actor: string;
}) {
  const revisions = await listStageArtifactSnapshots(input.missionId, input.stageId);
  const target = revisions.find((row) => row.revision === input.targetRevision);
  if (!target) throw new Error("ARTIFACT_REVISION_NOT_FOUND");
  if (!target.final_uri || !target.preview_uri) throw new Error("ROLLBACK_TARGET_NOT_FINAL");
  return persistSnapshot({
    missionId: input.missionId,
    stageId: input.stageId,
    actor: input.actor,
    status: "ROLLED_BACK",
    kind: target.kind,
    editable_uri: target.editable_uri,
    final_uri: target.final_uri,
    preview_uri: target.preview_uri,
    checksum: target.checksum,
    qa_evidence: target.qa_evidence,
    rollback_of_revision: target.revision,
  });
}

export function compareStageArtifactSnapshots(
  left: StageArtifactSnapshot,
  right: StageArtifactSnapshot,
) {
  const fields: Array<keyof StageArtifactSnapshot> = [
    "status",
    "kind",
    "editable_uri",
    "final_uri",
    "preview_uri",
    "checksum",
  ];
  return fields
    .filter((field) => JSON.stringify(left[field]) !== JSON.stringify(right[field]))
    .map((field) => ({ field, left: left[field], right: right[field] }));
}
