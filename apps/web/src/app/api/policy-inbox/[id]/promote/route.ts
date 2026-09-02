import { NextRequest } from "next/server";
import { z } from "zod";
import { requireSession } from "@/lib/auth/session";
import { handleRouteError, jsonError, jsonOk } from "@/lib/api/http";
import { approvePolicyPromotion } from "@/lib/services/policy-inbox";

type Ctx = { params: Promise<{ id: string }> };

const PromotePolicyRequestSchema = z.object({
  canonical_policy_id: z.string().min(1),
  reason: z.string().min(1),
});

export async function POST(req: NextRequest, ctx: Ctx) {
  try {
    const session = await requireSession();
    const { id } = await ctx.params;
    const body = PromotePolicyRequestSchema.parse(await req.json());
    const candidate = await approvePolicyPromotion({
      candidateId: id,
      canonicalPolicyId: body.canonical_policy_id,
      reason: body.reason,
      actor: session.actor,
    });
    return jsonOk({ ok: true, candidate });
  } catch (err) {
    if (err instanceof Error && err.message === "POLICY_CANDIDATE_NOT_FOUND") {
      return jsonError("POLICY_CANDIDATE_NOT_FOUND", "Policy candidate not found", 404);
    }
    if (err instanceof Error && err.message === "POLICY_PROMOTION_APPROVAL_REQUIRED") {
      return jsonError(
        "POLICY_PROMOTION_APPROVAL_REQUIRED",
        "Candidate must pass explicit review before canonical promotion",
        409,
      );
    }
    return handleRouteError(err);
  }
}
