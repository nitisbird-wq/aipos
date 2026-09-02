import { NextRequest } from "next/server";
import { requireSession } from "@/lib/auth/session";
import { handleRouteError, jsonError, jsonOk } from "@/lib/api/http";
import { runControlPlanePipeline } from "@/lib/services/control-plane-pipeline";
import { getMissionControlState } from "@/lib/services/control-plane-state";
import { evaluateMissionHealth } from "@/lib/services/health-supervisor";
import { runSupervisorAssessment } from "@/lib/services/aipos-supervisor";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, ctx: Ctx) {
  try {
    await requireSession();
    const { id } = await ctx.params;
    const [state, health, supervisor] = await Promise.all([
      getMissionControlState(id),
      evaluateMissionHealth(id),
      runSupervisorAssessment(id),
    ]);
    return jsonOk({ ok: true, state, health, supervisor });
  } catch (err) {
    if (err instanceof Error && err.message === "MISSION_NOT_FOUND") {
      return jsonError("MISSION_NOT_FOUND", "Mission not found", 404);
    }
    return handleRouteError(err);
  }
}

export async function POST(req: NextRequest, ctx: Ctx) {
  try {
    const session = await requireSession();
    const { id } = await ctx.params;
    const body = (await req.json().catch(() => ({}))) as {
      simulate_worker_pass?: boolean;
    };
    const result = await runControlPlanePipeline({
      missionId: id,
      actor: session.actor,
      simulateWorkerPass: body.simulate_worker_pass !== false,
    });
    return jsonOk({ ok: true, ...result });
  } catch (err) {
    if (err instanceof Error && err.message === "MISSION_NOT_FOUND") {
      return jsonError("MISSION_NOT_FOUND", "Mission not found", 404);
    }
    if (err instanceof Error && err.message === "BLUEPRINT_APPROVAL_REQUIRED") {
      return jsonError(
        "BLUEPRINT_APPROVAL_REQUIRED",
        "A persisted, explicitly approved Blueprint revision is required before dispatch",
        409,
      );
    }
    if (err instanceof Error && err.message.startsWith("CAPABILITY_ROUTE_REQUIRED")) {
      return jsonError(
        "CAPABILITY_ROUTE_REQUIRED",
        "No verified capability route is available; dispatch failed closed",
        422,
      );
    }
    if (err instanceof Error && err.message.includes("LINEAR_LIVE_MISCONFIGURED")) {
      return jsonError(
        "LINEAR_LIVE_MISCONFIGURED",
        "LINEAR_ADAPTER=live requires LINEAR_API_KEY and LINEAR_TEAM_ID",
        400,
      );
    }
    return handleRouteError(err);
  }
}
