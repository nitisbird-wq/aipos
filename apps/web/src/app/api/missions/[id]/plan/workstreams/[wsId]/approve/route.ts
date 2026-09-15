import { NextRequest } from "next/server";
import { requireSession } from "@/lib/auth/session";
import { handleRouteError, jsonError, jsonOk } from "@/lib/api/http";
import { approvePlanWorkstream } from "@/lib/services/mission-plan";
import { checkLock } from "@/lib/services/workstream-locks";

type Ctx = { params: Promise<{ id: string; wsId: string }> };

export async function POST(req: NextRequest, ctx: Ctx) {
  try {
    const session = await requireSession();
    const { id, wsId } = await ctx.params;
    const sessionId = req.headers.get("x-ws-session-id");
    const conflict = await checkLock(id, wsId, sessionId);
    if (conflict) {
      return jsonError(
        "WORKSTREAM_LOCKED",
        "Another session is already editing this workstream",
        409,
        { lock: conflict },
      );
    }
    const plan = await approvePlanWorkstream(id, wsId, session.actor);
    return jsonOk({ ok: true, plan });
  } catch (err) {
    if (err instanceof Error && err.message === "PLAN_NOT_FOUND") {
      return jsonError("PLAN_NOT_FOUND", "No plan exists for this mission", 404);
    }
    return handleRouteError(err);
  }
}
