import { clearSessionCookieOptions } from "@/lib/auth/session";
import { jsonOk } from "@/lib/api/http";

export async function POST() {
  const res = jsonOk({ ok: true });
  res.cookies.set(clearSessionCookieOptions());
  return res;
}
