import { NextRequest } from "next/server";
import { z } from "zod";
import { requireSession } from "@/lib/auth/session";
import { handleRouteError, jsonError, jsonOk } from "@/lib/api/http";
import { reviewPolicyCandidate } from "@/lib/services/policy-inbox";

type Ctx = { params: Promise<{ id: string }> };

const ReviewPolicyRequestSchema = z.object({
  decision: z.enum(["READY_FOR_PROMOTION", "REJECTED", "SUPERSEDED"]),
  reason: z.string().min(1),
});

export async function POST(req: NextRequest, ctx: Ctx) {
  try {
    const session = await requireSession();
    const { id } = await ctx.params;
    const body = ReviewPolicyRequestSchema.parse(await req.json());
    const candidate = await reviewPolicyCandidate({
      candidateId: id,
      actor: session.actor,
      ...body,
    });
    return jsonOk({ ok: true, candidate });
  } catch (err) {
    if (err instanceof Error && err.message === "POLICY_CANDIDATE_NOT_FOUND") {
      return jsonError("POLICY_CANDIDATE_NOT_FOUND", "Policy candidate not found", 404);
    }
    return handleRouteError(err);
  }
}
