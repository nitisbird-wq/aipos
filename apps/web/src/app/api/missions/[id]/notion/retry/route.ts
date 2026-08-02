import { NextRequest } from "next/server";
import { requireSession } from "@/lib/auth/session";
import { retryNotionSync } from "@/lib/services/notion-sync-service";
import { handleRouteError, jsonError, jsonOk } from "@/lib/api/http";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, ctx: Ctx) {
  try {
    const session = await requireSession();
    const { id } = await ctx.params;
    const body = await req.json().catch(() => ({}));
    const force = body?.force === true && body?.diagnostic === true;

    const result = await retryNotionSync({
      missionId: id,
      actor: session.actor,
      force,
      correlation_id: req.headers.get("x-correlation-id") ?? undefined,
    });

    if (!result.ok) {
      if (result.code === "MISSION_NOT_FOUND") {
        return jsonError(result.code, result.message, 404);
      }
      return jsonOk(result, { status: 422 });
    }

    return jsonOk(result);
  } catch (err) {
    return handleRouteError(err);
  }
}
