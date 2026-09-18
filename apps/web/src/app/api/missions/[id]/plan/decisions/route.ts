import { NextRequest } from "next/server";
import { requireSession } from "@/lib/auth/session";
import { handleRouteError, jsonError, jsonOk } from "@/lib/api/http";
import { applyDecisionBundle, DecisionBundleSchema } from "@/lib/services/plan-decision-applier";
import { ZodError } from "zod";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, ctx: Ctx) {
  try {
    const session = await requireSession();
    const { id } = await ctx.params;
    const body = await req.json();

    // Enforce mission_id consistency
    if (body?.mission_id && body.mission_id !== id) {
      return jsonError("MISSION_ID_MISMATCH", "bundle.mission_id does not match route :id", 422);
    }
    const bundle = DecisionBundleSchema.parse({ ...body, mission_id: id });
    const result = await applyDecisionBundle(bundle, session.actor);
    return jsonOk({ ok: result.ok, result }, { status: result.ok ? 200 : 207 });
  } catch (err) {
    if (err instanceof ZodError) {
      return jsonError("VALIDATION_ERROR", err.issues[0]?.message ?? "Invalid bundle", 422);
    }
    if (err instanceof Error) {
      if (err.message === "PLAN_NOT_FOUND")
        return jsonError("PLAN_NOT_FOUND", "No plan exists for this mission", 404);
      if (err.message.startsWith("PLAN_STALE")) return jsonError("PLAN_STALE", err.message, 409);
      if (err.message.startsWith("WORKSTREAM_NOT_FOUND"))
        return jsonError("WORKSTREAM_NOT_FOUND", err.message, 422);
      if (err.message.startsWith("DEPENDENCY_NOT_APPROVED"))
        return jsonError("DEPENDENCY_NOT_APPROVED", err.message, 422);
    }
    return handleRouteError(err);
  }
}
