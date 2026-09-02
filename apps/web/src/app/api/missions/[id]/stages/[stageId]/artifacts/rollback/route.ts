import { NextRequest } from "next/server";
import { z } from "zod";
import { requireSession } from "@/lib/auth/session";
import { handleRouteError, jsonError, jsonOk } from "@/lib/api/http";
import { rollbackStageArtifact } from "@/lib/services/stage-artifact";

type Ctx = { params: Promise<{ id: string; stageId: string }> };

const RollbackRequestSchema = z.object({
  target_revision: z.number().int().positive(),
});

export async function POST(req: NextRequest, ctx: Ctx) {
  try {
    const session = await requireSession();
    const { id, stageId } = await ctx.params;
    const body = RollbackRequestSchema.parse(await req.json());
    const artifact = await rollbackStageArtifact({
      missionId: id,
      stageId,
      targetRevision: body.target_revision,
      actor: session.actor,
    });
    return jsonOk({ ok: true, artifact });
  } catch (err) {
    if (err instanceof Error && err.message === "ARTIFACT_REVISION_NOT_FOUND") {
      return jsonError("ARTIFACT_REVISION_NOT_FOUND", "Artifact revision not found", 404);
    }
    return handleRouteError(err);
  }
}
