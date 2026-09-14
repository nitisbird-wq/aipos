import { NextRequest } from "next/server";
import { requireSession } from "@/lib/auth/session";
import { handleRouteError, jsonError, jsonOk } from "@/lib/api/http";
import { acquireLock, releaseLock } from "@/lib/services/workstream-locks";
import { z } from "zod";

type Ctx = { params: Promise<{ id: string; wsId: string }> };

const AcquireBodySchema = z.object({
  sessionId: z.string().min(1),
  planUrl: z.string().min(1),
});

export async function POST(req: NextRequest, ctx: Ctx) {
  try {
    const session = await requireSession();
    const { id, wsId } = await ctx.params;
    const body = AcquireBodySchema.parse(await req.json());
    const result = acquireLock(id, wsId, body.sessionId, session.actor, body.planUrl);
    if ("conflict" in result) {
      return jsonError(
        "WORKSTREAM_LOCKED",
        "Another session is already editing this workstream",
        409,
        { lock: result.conflict },
      );
    }
    return jsonOk({ ok: true, lock: result });
  } catch (err) {
    return handleRouteError(err);
  }
}

const ReleaseBodySchema = z.object({ sessionId: z.string().min(1) });

export async function DELETE(req: NextRequest, ctx: Ctx) {
  try {
    await requireSession();
    const { id, wsId } = await ctx.params;
    const body = ReleaseBodySchema.parse(await req.json());
    releaseLock(id, wsId, body.sessionId);
    return jsonOk({ ok: true });
  } catch (err) {
    return handleRouteError(err);
  }
}
