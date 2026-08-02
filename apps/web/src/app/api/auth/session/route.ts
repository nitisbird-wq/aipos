import { getSession } from "@/lib/auth/session";
import { getPersistenceMode } from "@/lib/repositories";
import { jsonOk } from "@/lib/api/http";

export async function GET() {
  const session = await getSession();
  return jsonOk({
    authenticated: !!session,
    email: session?.email ?? null,
    persistence_mode: getPersistenceMode(),
  });
}
