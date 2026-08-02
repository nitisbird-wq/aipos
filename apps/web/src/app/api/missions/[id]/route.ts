import { NextRequest } from "next/server";
import { requireSession } from "@/lib/auth/session";
import { getRepository } from "@/lib/repositories";
import { handleRouteError, jsonError, jsonOk } from "@/lib/api/http";
import { ownerVisibleRequest } from "@/lib/redact";

type Ctx = { params: Promise<{ id: string }> };

/** AIPOS-GOV-003 / Architecture Contract §12 — direct status patch forbidden. */
export async function PATCH() {
  return jsonError(
    "DIRECT_STATUS_PATCH_FORBIDDEN",
    "PATCH /missions/{id}/status is not allowed. Use POST /missions/{id}/transitions.",
    405,
  );
}

export async function GET(_req: NextRequest, ctx: Ctx) {
  try {
    await requireSession();
    const { id } = await ctx.params;
    const repo = getRepository();
    const mission = await repo.getMissionById(id);
    if (!mission) return jsonError("MISSION_NOT_FOUND", "Mission not found", 404);
    const notion_sync = await repo.getNotionSync(id);
    const intake = await repo.getIntakeById(mission.source_intake_id);

    // Owner-facing detail: full confirmed request (no unnecessary redaction)
    const ownerRaw =
      typeof intake?.raw_request === "string" ? ownerVisibleRequest(intake.raw_request) : null;

    return jsonOk({
      ok: true,
      mission,
      notion_sync,
      intake: intake
        ? {
            intake_id: intake.intake_id,
            raw_request: ownerRaw?.text ?? intake.raw_request,
            view: "owner",
            readiness_status: intake.readiness_status,
          }
        : null,
    });
  } catch (err) {
    return handleRouteError(err);
  }
}
