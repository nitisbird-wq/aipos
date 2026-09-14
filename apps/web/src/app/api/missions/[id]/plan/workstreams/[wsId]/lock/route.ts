import { NextRequest } from "next/server";
import { requireSession } from "@/lib/auth/session";
import { handleRouteError, jsonError, jsonOk } from "@/lib/api/http";
import { acquireLock, releaseLock, isValidPlanUrl } from "@/lib/services/workstream-locks";
import { getRepository } from "@/lib/repositories";
import { newAuditId, newCorrelationId, nowIso } from "@/lib/ids";
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

    if (!isValidPlanUrl(body.planUrl)) {
      return jsonError("INVALID_PLAN_URL", "planUrl must be an internal /intake/…/plan path", 400);
    }

    const result = await acquireLock(id, wsId, body.sessionId, session.actor, body.planUrl);

    const repo = getRepository();
    const correlationId = newCorrelationId();

    if ("conflict" in result) {
      await repo.appendAudit({
        id: newAuditId(),
        aggregate_type: "system",
        mission_id: id,
        intake_id: null,
        actor: session.actor,
        action: "workstream:lock:conflict",
        reason: `Session ${body.sessionId} blocked — lock held by ${result.conflict.sessionId}`,
        correlation_id: correlationId,
        causation_id: null,
        previous_state: "LOCKED",
        new_state: "LOCKED",
        policy_result: { decision: "block", wsId, conflict: result.conflict },
        created_at: nowIso(),
      });
      return jsonError(
        "WORKSTREAM_LOCKED",
        "Another session is already editing this workstream",
        409,
        { lock: result.conflict },
      );
    }

    await repo.appendAudit({
      id: newAuditId(),
      aggregate_type: "system",
      mission_id: id,
      intake_id: null,
      actor: session.actor,
      action: "workstream:lock:acquired",
      reason: `Session ${body.sessionId} acquired edit lock on workstream ${wsId}`,
      correlation_id: correlationId,
      causation_id: null,
      previous_state: "FREE",
      new_state: "LOCKED",
      policy_result: { decision: "allow", wsId, lock: result },
      created_at: nowIso(),
    });

    return jsonOk({ ok: true, lock: result });
  } catch (err) {
    return handleRouteError(err);
  }
}

const ReleaseBodySchema = z.object({ sessionId: z.string().min(1) });

export async function DELETE(req: NextRequest, ctx: Ctx) {
  try {
    const session = await requireSession();
    const { id, wsId } = await ctx.params;
    const body = ReleaseBodySchema.parse(await req.json());
    const released = await releaseLock(id, wsId, body.sessionId);

    if (released) {
      const repo = getRepository();
      await repo.appendAudit({
        id: newAuditId(),
        aggregate_type: "system",
        mission_id: id,
        intake_id: null,
        actor: session.actor,
        action: "workstream:lock:released",
        reason: `Session ${body.sessionId} released edit lock on workstream ${wsId}`,
        correlation_id: newCorrelationId(),
        causation_id: null,
        previous_state: "LOCKED",
        new_state: "FREE",
        policy_result: { decision: "allow", wsId },
        created_at: nowIso(),
      });
    }

    return jsonOk({ ok: true, released });
  } catch (err) {
    return handleRouteError(err);
  }
}
