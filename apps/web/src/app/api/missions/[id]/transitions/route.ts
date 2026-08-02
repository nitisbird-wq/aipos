import { NextRequest } from "next/server";
import { requireSession } from "@/lib/auth/session";
import { TransitionCommandSchema } from "@/lib/schemas/mission";
import { applyMissionTransition } from "@/lib/services/transition-service";
import { handleRouteError, jsonOk } from "@/lib/api/http";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, ctx: Ctx) {
  try {
    const session = await requireSession();
    const { id } = await ctx.params;
    const body = TransitionCommandSchema.parse(await req.json());
    const correlation = req.headers.get("x-correlation-id") ?? body.correlation_id;
    const result = await applyMissionTransition({
      missionId: id,
      command: body.command,
      reason: body.reason,
      actor: session.actor,
      correlation_id: correlation,
    });
    if (!result.ok) {
      return jsonOk(result, { status: 422 });
    }
    return jsonOk(result);
  } catch (err) {
    return handleRouteError(err);
  }
}
