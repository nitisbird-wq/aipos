import { NextRequest } from "next/server";
import { z } from "zod";
import { requireSession } from "@/lib/auth/session";
import { handleRouteError, jsonError, jsonOk } from "@/lib/api/http";
import { MissionStageSchema } from "@/lib/schemas/mission-blueprint";
import {
  getLatestMissionBlueprint,
  listMissionBlueprints,
  saveMissionBlueprint,
} from "@/lib/services/mission-blueprint";

type Ctx = { params: Promise<{ id: string }> };

const SaveBlueprintRequestSchema = z.object({
  final_outcome: z.string().min(1),
  definition_of_done: z.string().min(1),
  stages: z.array(MissionStageSchema).min(1),
  critical_path: z.array(z.string()).min(1),
  next_action: z.string().min(1),
});

export async function GET(_req: NextRequest, ctx: Ctx) {
  try {
    await requireSession();
    const { id } = await ctx.params;
    const [latest, revisions] = await Promise.all([
      getLatestMissionBlueprint(id),
      listMissionBlueprints(id),
    ]);
    return jsonOk({ ok: true, latest, revisions });
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
    const body = SaveBlueprintRequestSchema.parse(await req.json());
    const blueprint = await saveMissionBlueprint({
      missionId: id,
      actor: session.actor,
      ...body,
    });
    return jsonOk({ ok: true, blueprint }, { status: 201 });
  } catch (err) {
    if (err instanceof Error && err.message === "MISSION_NOT_FOUND") {
      return jsonError("MISSION_NOT_FOUND", "Mission not found", 404);
    }
    return handleRouteError(err);
  }
}
