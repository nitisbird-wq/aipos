import { NextRequest } from "next/server";
import { z } from "zod";
import { requireSession } from "@/lib/auth/session";
import { handleRouteError, jsonError, jsonOk } from "@/lib/api/http";
import { ArtifactQaEvidenceSchema } from "@/lib/schemas/stage-artifact";
import {
  compareStageArtifactSnapshots,
  listStageArtifactSnapshots,
  saveStageArtifactSnapshot,
} from "@/lib/services/stage-artifact";

type Ctx = { params: Promise<{ id: string; stageId: string }> };

const SaveArtifactRequestSchema = z.object({
  status: z.enum(["DRAFT", "FINAL"]),
  kind: z.string().min(1),
  editable_uri: z.string().min(1),
  final_uri: z.string().min(1).nullable().optional(),
  preview_uri: z.string().min(1).nullable().optional(),
  checksum: z.string().min(1),
  qa_evidence: z.array(ArtifactQaEvidenceSchema),
});

export async function GET(req: NextRequest, ctx: Ctx) {
  try {
    await requireSession();
    const { id, stageId } = await ctx.params;
    const revisions = await listStageArtifactSnapshots(id, stageId);
    const leftRevision = Number(req.nextUrl.searchParams.get("left"));
    const rightRevision = Number(req.nextUrl.searchParams.get("right"));
    const left = revisions.find((row) => row.revision === leftRevision);
    const right = revisions.find((row) => row.revision === rightRevision);
    return jsonOk({
      ok: true,
      latest: revisions[0] ?? null,
      revisions,
      comparison: left && right ? compareStageArtifactSnapshots(left, right) : [],
    });
  } catch (err) {
    if (err instanceof Error && err.message === "MISSION_NOT_FOUND") {
      return jsonError("MISSION_NOT_FOUND", "Mission not found", 404);
    }
    return handleRouteError(err);
  }
}

export async function POST(req: NextRequest, ctx: Ctx) {
  try {
    const session = await requireSession();
    const { id, stageId } = await ctx.params;
    const body = SaveArtifactRequestSchema.parse(await req.json());
    const artifact = await saveStageArtifactSnapshot({
      missionId: id,
      stageId,
      actor: session.actor,
      ...body,
    });
    return jsonOk({ ok: true, artifact }, { status: 201 });
  } catch (err) {
    return handleRouteError(err);
  }
}
