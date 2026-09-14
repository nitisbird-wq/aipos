import { NextRequest } from "next/server";
import { requireSession } from "@/lib/auth/session";
import { handleRouteError, jsonError, jsonOk } from "@/lib/api/http";
import { approvePlanWorkstream } from "@/lib/services/mission-plan";

type Ctx = { params: Promise<{ id: string; wsId: string }> };

export async function POST(_req: NextRequest, ctx: Ctx) {
  try {
    const session = await requireSession();
    const { id, wsId } = await ctx.params;
    const plan = await approvePlanWorkstream(id, wsId, session.actor);
    return jsonOk({ ok: true, plan });
  } catch (err) {
    if (err instanceof Error && err.message === "PLAN_NOT_FOUND") {
      return jsonError("PLAN_NOT_FOUND", "No plan exists for this mission", 404);
    }
    return handleRouteError(err);
  }
}
