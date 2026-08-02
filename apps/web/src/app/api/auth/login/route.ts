import { NextRequest } from "next/server";
import { encodeSession, sessionCookieOptions, verifyOperatorCredentials } from "@/lib/auth/session";
import { jsonError, jsonOk, handleRouteError } from "@/lib/api/http";
import { z } from "zod";

const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export async function POST(req: NextRequest) {
  try {
    const body = LoginSchema.parse(await req.json());
    if (!verifyOperatorCredentials(body.email, body.password)) {
      return jsonError("INVALID_CREDENTIALS", "Invalid email or password", 401);
    }
    const token = encodeSession({
      email: body.email,
      name: "Operator",
      actor: `operator:${body.email}`,
      issued_at: new Date().toISOString(),
    });
    const res = jsonOk({ ok: true, email: body.email });
    res.cookies.set(sessionCookieOptions(token));
    return res;
  } catch (err) {
    return handleRouteError(err);
  }
}
