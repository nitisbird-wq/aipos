import { createHmac, timingSafeEqual } from "crypto";
import { cookies } from "next/headers";

const COOKIE_NAME = "aipos_session";
const MAX_AGE_SEC = 60 * 60 * 24 * 7;

export type OperatorSession = {
  email: string;
  name: string;
  actor: string;
  issued_at: string;
};

function secret(): string {
  return process.env.NEXTAUTH_SECRET || "dev-only-insecure-secret";
}

function sign(payload: string): string {
  return createHmac("sha256", secret()).update(payload).digest("base64url");
}

export function encodeSession(session: OperatorSession): string {
  const body = Buffer.from(JSON.stringify(session), "utf8").toString("base64url");
  const sig = sign(body);
  return `${body}.${sig}`;
}

export function decodeSession(token: string): OperatorSession | null {
  const [body, sig] = token.split(".");
  if (!body || !sig) return null;
  const expected = sign(body);
  try {
    const a = Buffer.from(sig);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  } catch {
    return null;
  }
  try {
    return JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as OperatorSession;
  } catch {
    return null;
  }
}

export async function getSession(): Promise<OperatorSession | null> {
  const jar = await cookies();
  const raw = jar.get(COOKIE_NAME)?.value;
  if (!raw) return null;
  return decodeSession(raw);
}

export async function requireSession(): Promise<OperatorSession> {
  const session = await getSession();
  if (!session) {
    throw new AuthError("Unauthorized");
  }
  return session;
}

export function sessionCookieOptions(token: string) {
  return {
    name: COOKIE_NAME,
    value: token,
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: MAX_AGE_SEC,
  };
}

export function clearSessionCookieOptions() {
  return {
    name: COOKIE_NAME,
    value: "",
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  };
}

export function verifyOperatorCredentials(email: string, password: string): boolean {
  const expectedEmail = process.env.OPERATOR_EMAIL || "operator@example.com";
  const expectedPassword = process.env.OPERATOR_PASSWORD || "dev-password";
  return email === expectedEmail && password === expectedPassword;
}

export class AuthError extends Error {
  status = 401;
  constructor(message: string) {
    super(message);
    this.name = "AuthError";
  }
}
