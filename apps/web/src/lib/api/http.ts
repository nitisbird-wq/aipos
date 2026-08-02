import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { AuthError } from "@/lib/auth/session";

export function jsonOk<T>(data: T, init?: ResponseInit) {
  return NextResponse.json(data, init);
}

export function jsonError(
  code: string,
  message: string,
  status = 400,
  extra?: Record<string, unknown>,
) {
  return NextResponse.json({ ok: false, error: { code, message, ...extra } }, { status });
}

export function handleRouteError(err: unknown) {
  if (err instanceof AuthError) {
    return jsonError("UNAUTHORIZED", err.message, 401);
  }
  if (err instanceof ZodError) {
    return jsonError("VALIDATION_ERROR", err.issues.map((i) => i.message).join("; "), 400, {
      issues: err.issues,
    });
  }
  if (err instanceof Error) {
    if (err.message === "INTAKE_NOT_FOUND") {
      return jsonError("INTAKE_NOT_FOUND", "Intake not found", 404);
    }
    if (err.message === "INTAKE_ALREADY_CONFIRMED") {
      return jsonError("INTAKE_ALREADY_CONFIRMED", "Intake already confirmed", 409);
    }
    console.error("[aipos] route error", err.name, err.message);
    return jsonError("INTERNAL_ERROR", "Unexpected error", 500);
  }
  return jsonError("INTERNAL_ERROR", "Unexpected error", 500);
}
