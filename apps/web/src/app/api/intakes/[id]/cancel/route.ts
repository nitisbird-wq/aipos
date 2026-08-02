import { NextRequest } from "next/server";
import { requireSession } from "@/lib/auth/session";
import { cancelIntake } from "@/lib/services/intake-service";
import { handleRouteError, jsonOk } from "@/lib/api/http";
import { z } from "zod";

type Ctx = { params: Promise<{ id: string }> };

const BodySchema = z.object({
  reason: z.string().min(1).default("User cancelled intake"),
});

export async function POST(req: NextRequest, ctx: Ctx) {
  try {
    const session = await requireSession();
    const { id } = await ctx.params;
    const body = BodySchema.parse(await req.json().catch(() => ({})));
    const bundle = await cancelIntake(id, session.actor, body.reason);
    return jsonOk({ ok: true, bundle });
  } catch (err) {
    return handleRouteError(err);
  }
}
