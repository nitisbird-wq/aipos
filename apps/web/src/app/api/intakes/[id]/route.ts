import { NextRequest } from "next/server";
import { requireSession } from "@/lib/auth/session";
import { CorrectIntakeRequestSchema } from "@/lib/schemas/intake";
import { getRepository } from "@/lib/repositories";
import { correctIntake } from "@/lib/services/intake-service";
import { handleRouteError, jsonError, jsonOk } from "@/lib/api/http";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, ctx: Ctx) {
  try {
    await requireSession();
    const { id } = await ctx.params;
    const bundle = await getRepository().getIntakeById(id);
    if (!bundle) return jsonError("INTAKE_NOT_FOUND", "Intake not found", 404);
    return jsonOk({ ok: true, bundle });
  } catch (err) {
    return handleRouteError(err);
  }
}

export async function PATCH(req: NextRequest, ctx: Ctx) {
  try {
    const session = await requireSession();
    const { id } = await ctx.params;
    const body = CorrectIntakeRequestSchema.parse(await req.json());
    const bundle = await correctIntake(id, body, session.actor);
    return jsonOk({ ok: true, bundle });
  } catch (err) {
    return handleRouteError(err);
  }
}
