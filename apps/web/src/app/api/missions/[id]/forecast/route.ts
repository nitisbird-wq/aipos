import { NextRequest } from "next/server";
import { z } from "zod";
import { requireSession } from "@/lib/auth/session";
import { handleRouteError, jsonOk } from "@/lib/api/http";
import { calculateMissionForecast } from "@/lib/services/scope-guard";

type Ctx = { params: Promise<{ id: string }> };

const ForecastRequestSchema = z.object({
  stages: z.array(
    z.object({
      stage_id: z.string().min(1),
      min_hours: z.number().min(0),
      max_hours: z.number().min(0),
      assumption: z.string().min(1),
    }),
  ),
});

export async function POST(req: NextRequest, ctx: Ctx) {
  try {
    await requireSession();
    const { id } = await ctx.params;
    const body = ForecastRequestSchema.parse(await req.json());
    return jsonOk({
      ok: true,
      forecast: calculateMissionForecast({ missionId: id, stages: body.stages }),
    });
  } catch (err) {
    return handleRouteError(err);
  }
}
