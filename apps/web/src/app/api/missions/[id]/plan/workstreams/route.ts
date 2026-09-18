import { NextRequest } from "next/server";
import { requireSession } from "@/lib/auth/session";
import { handleRouteError, jsonError, jsonOk } from "@/lib/api/http";
import { addPlanWorkstream, type AddWorkstreamDraft } from "@/lib/services/mission-plan";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, ctx: Ctx) {
  try {
    const session = await requireSession();
    const { id } = await ctx.params;
    const body = (await req.json()) as AddWorkstreamDraft;
    const plan = await addPlanWorkstream(id, body, session.actor);
    return jsonOk({ ok: true, plan }, { status: 201 });
  } catch (err) {
    if (err instanceof Error && err.message === "MISSION_NOT_FOUND") {
      return jsonError("MISSION_NOT_FOUND", "Mission not found", 404);
    }
    if (err instanceof Error && err.message === "PLAN_NOT_FOUND") {
      return jsonError("PLAN_NOT_FOUND", "No plan exists for this mission", 404);
    }
    return handleRouteError(err);
  }
}
