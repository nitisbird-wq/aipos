import { z } from "zod";

export const ArtifactQaEvidenceSchema = z.object({
  check: z.string().min(1),
  status: z.enum(["PASS", "FAIL"]),
  evidence_ref: z.string().min(1),
  verified_at: z.string().datetime(),
  verified_by: z.string().min(1),
});

export const StageArtifactSnapshotSchema = z.object({
  artifact_version: z.literal("stage-artifact.v1"),
  artifact_id: z.string().min(1),
  mission_id: z.string().min(1),
  stage_id: z.string().min(1),
  revision: z.number().int().positive(),
  status: z.enum(["DRAFT", "FINAL", "SUPERSEDED", "ROLLED_BACK"]),
  kind: z.string().min(1),
  editable_uri: z.string().min(1),
  final_uri: z.string().min(1).nullable(),
  preview_uri: z.string().min(1).nullable(),
  checksum: z.string().min(1),
  qa_evidence: z.array(ArtifactQaEvidenceSchema),
  parent_revision: z.number().int().positive().nullable(),
  rollback_of_revision: z.number().int().positive().nullable(),
  created_at: z.string().datetime(),
  created_by: z.string().min(1),
});

export type ArtifactQaEvidence = z.infer<typeof ArtifactQaEvidenceSchema>;
export type StageArtifactSnapshot = z.infer<typeof StageArtifactSnapshotSchema>;
