import { requireSession } from "@/lib/auth/session";
import { handleRouteError, jsonOk } from "@/lib/api/http";
import { acceptStageArtifact } from "@/lib/services/stage-artifact";

type Ctx = { params: Promise<{ id: string; stageId: string }> };

export async function POST(_req: Request, ctx: Ctx) {
  try {
    const session = await requireSession();
    const { id, stageId } = await ctx.params;
    const result = await acceptStageArtifact({
      missionId: id,
      stageId,
      actor: session.actor,
    });
    return jsonOk({ ok: true, ...result });
  } catch (err) {
    return handleRouteError(err);
  }
}
