import { NextRequest } from "next/server";
import { z } from "zod";
import { requireSession } from "@/lib/auth/session";
import { handleRouteError, jsonError, jsonOk } from "@/lib/api/http";
import { approveMissionBlueprint } from "@/lib/services/mission-blueprint";

type Ctx = { params: Promise<{ id: string }> };

const ApproveBlueprintRequestSchema = z.object({
  revision: z.number().int().positive(),
});

export async function POST(req: NextRequest, ctx: Ctx) {
  try {
    const session = await requireSession();
    const { id } = await ctx.params;
    const body = ApproveBlueprintRequestSchema.parse(await req.json());
    const blueprint = await approveMissionBlueprint({
      missionId: id,
      revision: body.revision,
      actor: session.actor,
    });
    return jsonOk({ ok: true, blueprint });
  } catch (err) {
    if (err instanceof Error && err.message === "MISSION_NOT_FOUND") {
      return jsonError("MISSION_NOT_FOUND", "Mission not found", 404);
    }
    if (err instanceof Error && err.message === "BLUEPRINT_NOT_FOUND") {
      return jsonError("BLUEPRINT_NOT_FOUND", "Blueprint not found", 404);
    }
    if (err instanceof Error && err.message === "STALE_BLUEPRINT_REVISION") {
      return jsonError(
        "STALE_BLUEPRINT_REVISION",
        "Only the latest Blueprint revision can be approved",
        409,
      );
    }
    return handleRouteError(err);
  }
}
