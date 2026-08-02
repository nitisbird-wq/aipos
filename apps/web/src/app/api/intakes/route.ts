import { NextRequest } from "next/server";
import { requireSession } from "@/lib/auth/session";
import { CreateIntakeRequestSchema } from "@/lib/schemas/intake";
import { analyzeIntake, createIntake } from "@/lib/services/intake-service";
import { handleRouteError, jsonOk } from "@/lib/api/http";

export async function POST(req: NextRequest) {
  try {
    const session = await requireSession();
    const body = await req.json();
    const idempotencyHeader = req.headers.get("idempotency-key") ?? undefined;
    const parsed = CreateIntakeRequestSchema.parse({
      ...body,
      idempotency_key: body.idempotency_key ?? idempotencyHeader,
    });
    const { bundle, reused } = await createIntake(parsed, session.actor);
    const analyzed = reused ? bundle : await analyzeIntake(bundle.intake_id, session.actor);
    return jsonOk({
      ok: true,
      intake_id: analyzed.intake_id,
      reused,
      bundle: analyzed,
    });
  } catch (err) {
    return handleRouteError(err);
  }
}
