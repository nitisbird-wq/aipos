import { requireSession } from "@/lib/auth/session";
import { getRepository } from "@/lib/repositories";
import { handleRouteError, jsonOk } from "@/lib/api/http";

export async function GET() {
  try {
    await requireSession();
    const repo = getRepository();
    const missions = await repo.listMissions();
    const withSync = await Promise.all(
      missions.map(async (m) => ({
        ...m,
        notion_sync: await repo.getNotionSync(m.mission_id),
      })),
    );
    return jsonOk({ ok: true, missions: withSync, persistence_mode: repo.adapterName });
  } catch (err) {
    return handleRouteError(err);
  }
}
