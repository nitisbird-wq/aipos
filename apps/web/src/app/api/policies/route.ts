import { requireSession } from "@/lib/auth/session";
import { getRepository } from "@/lib/repositories";
import { handleRouteError, jsonOk } from "@/lib/api/http";

export async function GET() {
  try {
    await requireSession();
    const policies = await getRepository().listPolicies();
    return jsonOk({ ok: true, policies });
  } catch (err) {
    return handleRouteError(err);
  }
}
