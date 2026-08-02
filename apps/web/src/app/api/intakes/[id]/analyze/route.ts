import { NextRequest } from "next/server";
import { requireSession } from "@/lib/auth/session";
import { analyzeIntake } from "@/lib/services/intake-service";
import { handleRouteError, jsonOk } from "@/lib/api/http";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(_req: NextRequest, ctx: Ctx) {
  try {
    const session = await requireSession();
    const { id } = await ctx.params;
    const bundle = await analyzeIntake(id, session.actor);
    return jsonOk({ ok: true, bundle });
  } catch (err) {
    return handleRouteError(err);
  }
}
