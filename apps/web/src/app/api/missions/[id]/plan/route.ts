import { NextRequest } from "next/server";
import { z } from "zod";
import { requireSession } from "@/lib/auth/session";
import { handleRouteError, jsonError, jsonOk } from "@/lib/api/http";
import { generateMissionPlan, getPlanReviewState } from "@/lib/services/mission-plan";
import { buildMissionContextPack, buildMissionStrategy } from "@/lib/services/mission-strategist";
import { analyzeMissionHeuristic } from "@/lib/services/analyze";
import { getRepository } from "@/lib/repositories";
import { nowIso } from "@/lib/ids";

type Ctx = { params: Promise<{ id: string }> };

const GeneratePlanRequestSchema = z.object({}).optional();

export async function GET(_req: NextRequest, ctx: Ctx) {
  try {
    await requireSession();
    const { id } = await ctx.params;
    const plan = await getPlanReviewState(id);
    if (!plan) return jsonError("PLAN_NOT_FOUND", "No plan exists for this mission", 404);
    return jsonOk({ ok: true, plan });
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
    GeneratePlanRequestSchema.parse(await req.json().catch(() => ({})));
    const repo = getRepository();
    const mission = await repo.getMissionById(id);
    if (!mission) return jsonError("MISSION_NOT_FOUND", "Mission not found", 404);
    const analysis = analyzeMissionHeuristic(
      mission.mission_summary || mission.title || mission.desired_outcome || id,
    );
    const contextPack = buildMissionContextPack({
      missionId: id,
      actor: session.actor,
      context: [
        {
          id: `CTX-${id}`,
          context_class: "LIVE",
          domain: "mission",
          type: "mission_summary",
          statement: mission.mission_summary || mission.title || "",
          source: "app_db",
          provenance: `mission:${id}`,
          status: "REPORTED",
          version: "1.0",
          effective_at: nowIso(),
          freshness: "fresh",
          review_due: nowIso(),
          confidence: 0.85,
          evidence: [],
          owner: session.actor,
          sensitivity: (mission.sensitivity_flags?.length ?? 0) > 0 ? "restricted" : "internal",
          access: "need_to_know",
          supersedes: [],
          conflicts_with: [],
        },
      ],
    });
    const strategy = buildMissionStrategy({ missionId: id, analysis, contextPack });
    const plan = await generateMissionPlan({ missionId: id, strategy, actor: session.actor });
    return jsonOk({ ok: true, plan }, { status: 201 });
  } catch (err) {
    if (err instanceof Error && err.message === "MISSION_NOT_FOUND") {
      return jsonError("MISSION_NOT_FOUND", "Mission not found", 404);
    }
    return handleRouteError(err);
  }
}
