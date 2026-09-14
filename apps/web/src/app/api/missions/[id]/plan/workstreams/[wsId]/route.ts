import { NextRequest } from "next/server";
import { requireSession } from "@/lib/auth/session";
import { handleRouteError, jsonError, jsonOk } from "@/lib/api/http";
import {
  editPlanWorkstream,
  removePlanWorkstream,
  type EditWorkstreamPatch,
} from "@/lib/services/mission-plan";
import { checkLock } from "@/lib/services/workstream-locks";

type Ctx = { params: Promise<{ id: string; wsId: string }> };

export async function PATCH(req: NextRequest, ctx: Ctx) {
  try {
    const session = await requireSession();
    const { id, wsId } = await ctx.params;
    const sessionId = req.headers.get("x-ws-session-id");
    const conflict = checkLock(id, wsId, sessionId);
    if (conflict) {
      return jsonError(
        "WORKSTREAM_LOCKED",
        "Another session is already editing this workstream",
        409,
        { lock: conflict },
      );
    }
    const body = (await req.json()) as EditWorkstreamPatch;
    const plan = await editPlanWorkstream(id, wsId, body, session.actor);
    return jsonOk({ ok: true, plan });
  } catch (err) {
    if (err instanceof Error && err.message === "PLAN_NOT_FOUND") {
      return jsonError("PLAN_NOT_FOUND", "No plan exists for this mission", 404);
    }
    return handleRouteError(err);
  }
}

export async function DELETE(req: NextRequest, ctx: Ctx) {
  try {
    const session = await requireSession();
    const { id, wsId } = await ctx.params;
    const sessionId = req.headers.get("x-ws-session-id");
    const conflict = checkLock(id, wsId, sessionId);
    if (conflict) {
      return jsonError(
        "WORKSTREAM_LOCKED",
        "Another session is already editing this workstream",
        409,
        { lock: conflict },
      );
    }
    const plan = await removePlanWorkstream(id, wsId, session.actor);
    return jsonOk({ ok: true, plan });
  } catch (err) {
    if (err instanceof Error && err.message === "PLAN_NOT_FOUND") {
      return jsonError("PLAN_NOT_FOUND", "No plan exists for this mission", 404);
    }
    if (err instanceof Error && err.message === "CANNOT_REMOVE_LAST_WORKSTREAM") {
      return jsonError("CANNOT_REMOVE_LAST_WORKSTREAM", "Cannot remove the last workstream", 422);
    }
    return handleRouteError(err);
  }
}
