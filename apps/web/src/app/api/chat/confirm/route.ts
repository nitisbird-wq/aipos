import { NextRequest } from "next/server";
import { requireSession } from "@/lib/auth/session";
import { confirmChatIntake } from "@/lib/services/chat-intake-service";
import { handleRouteError, jsonOk } from "@/lib/api/http";
import { z } from "zod";

const BodySchema = z.object({
  intake_id: z.string().min(1),
  sensitivity_acknowledged: z.boolean().optional(),
});

export async function POST(req: NextRequest) {
  try {
    const session = await requireSession();
    const body = BodySchema.parse(await req.json());
    const result = await confirmChatIntake(
      body.intake_id,
      session.actor,
      body.sensitivity_acknowledged,
    );
    if (!result.ok) {
      return jsonOk(result, { status: 422 });
    }
    return jsonOk(result);
  } catch (err) {
    return handleRouteError(err);
  }
}
