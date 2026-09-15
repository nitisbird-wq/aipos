import { NextRequest } from "next/server";
import { z } from "zod";
import { requireSession } from "@/lib/auth/session";
import { handleRouteError, jsonError, jsonOk } from "@/lib/api/http";
import { answerOwnerQuestion } from "@/lib/services/mission-plan";

type Ctx = { params: Promise<{ id: string; qId: string }> };

const AnswerSchema = z.object({ answer: z.string() });

export async function PATCH(req: NextRequest, ctx: Ctx) {
  try {
    const session = await requireSession();
    const { id, qId } = await ctx.params;
    const { answer } = AnswerSchema.parse(await req.json());
    const plan = await answerOwnerQuestion(id, qId, answer, session.actor);
    return jsonOk({ ok: true, plan });
  } catch (err) {
    if (err instanceof Error && err.message === "PLAN_NOT_FOUND") {
      return jsonError("PLAN_NOT_FOUND", "No plan exists for this mission", 404);
    }
    return handleRouteError(err);
  }
}
