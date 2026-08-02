import { NextRequest } from "next/server";
import { requireSession } from "@/lib/auth/session";
import { getRepository } from "@/lib/repositories";
import { handleRouteError, jsonOk } from "@/lib/api/http";
import { redactForAuditDisplay } from "@/lib/redact";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, ctx: Ctx) {
  try {
    await requireSession();
    const { id } = await ctx.params;
    const events = await getRepository().listAudit({ mission_id: id });
    const redacted = events.map((e) => ({
      ...e,
      policy_result: redactForAuditDisplay(e.policy_result as Record<string, unknown>),
    }));
    return jsonOk({ ok: true, events: redacted });
  } catch (err) {
    return handleRouteError(err);
  }
}
