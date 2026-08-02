import { NextRequest } from "next/server";
import { requireSession } from "@/lib/auth/session";
import { confirmIntake } from "@/lib/services/intake-service";
import { handleRouteError, jsonOk } from "@/lib/api/http";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, ctx: Ctx) {
  try {
    const session = await requireSession();
    const { id } = await ctx.params;
    const body = await req.json().catch(() => ({}));
    const correlation = req.headers.get("x-correlation-id") ?? undefined;
    const result = await confirmIntake(id, body, session.actor, correlation);
    if (!result.ok) {
      return jsonOk(result, { status: 422 });
    }
    return jsonOk(result);
  } catch (err) {
    return handleRouteError(err);
  }
}
