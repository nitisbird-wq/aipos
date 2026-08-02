import { requireSession } from "@/lib/auth/session";
import { getRepository } from "@/lib/repositories";
import { handleRouteError, jsonOk } from "@/lib/api/http";

export async function GET() {
  try {
    await requireSession();
    const capabilities = await getRepository().listCapabilities();
    return jsonOk({ ok: true, capabilities });
  } catch (err) {
    return handleRouteError(err);
  }
}
