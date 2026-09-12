import { NextRequest } from "next/server";
import { z } from "zod";
import { requireSession } from "@/lib/auth/session";
import { handleRouteError, jsonOk } from "@/lib/api/http";
import { approveMaterialScopeChange } from "@/lib/services/scope-guard";

type Ctx = { params: Promise<{ id: string; scopeId: string }> };

const ApprovalRequestSchema = z.object({
  tradeoff: z.string().min(1),
});

export async function POST(req: NextRequest, ctx: Ctx) {
  try {
    const session = await requireSession();
    const { id, scopeId } = await ctx.params;
    const body = ApprovalRequestSchema.parse(await req.json());
    const item = await approveMaterialScopeChange({
      missionId: id,
      scopeItemId: scopeId,
      tradeoff: body.tradeoff,
      actor: session.actor,
    });
    return jsonOk({ ok: true, item });
  } catch (err) {
    return handleRouteError(err);
  }
}
