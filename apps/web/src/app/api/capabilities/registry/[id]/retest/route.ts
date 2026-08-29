import { NextRequest } from "next/server";
import { z } from "zod";
import { requireSession } from "@/lib/auth/session";
import { handleRouteError, jsonError, jsonOk } from "@/lib/api/http";
import { recordCapabilityRetest } from "@/lib/services/capability-registry";

type Ctx = { params: Promise<{ id: string }> };

const RetestRequestSchema = z.object({
  outcome: z.enum(["PASS", "PARTIAL", "FAIL"]),
  evidence_refs: z.array(z.string()),
  expires_at: z.string().datetime().nullable().optional(),
  retest_due_at: z.string().datetime().nullable().optional(),
  reason: z.string().min(1).optional(),
});

export async function POST(req: NextRequest, ctx: Ctx) {
  try {
    const session = await requireSession();
    const { id } = await ctx.params;
    const body = RetestRequestSchema.parse(await req.json());
    const capability = await recordCapabilityRetest({
      capabilityId: id,
      actor: session.actor,
      ...body,
    });
    return jsonOk({ ok: true, capability });
  } catch (err) {
    if (err instanceof Error && err.message === "CAPABILITY_NOT_FOUND") {
      return jsonError("CAPABILITY_NOT_FOUND", "Capability not found", 404);
    }
    return handleRouteError(err);
  }
}
