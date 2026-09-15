import { _clearLocksForTest } from "@/lib/services/workstream-locks";

export async function POST() {
  if (process.env.NODE_ENV === "production") {
    return Response.json({ ok: false, error: "not available" }, { status: 404 });
  }
  await _clearLocksForTest();
  return Response.json({ ok: true });
}
