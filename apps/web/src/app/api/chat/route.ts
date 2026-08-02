import { NextRequest } from "next/server";
import { requireSession } from "@/lib/auth/session";
import {
  ChatTurnRequestSchema,
  handleChatTurn,
  initialChatSession,
} from "@/lib/services/chat-intake-service";
import { handleRouteError, jsonOk } from "@/lib/api/http";
import { detectLanguage } from "@/lib/services/analyze";

/** Start a Mission Commander session (welcome only). */
export async function GET(req: NextRequest) {
  try {
    await requireSession();
    const langParam = req.nextUrl.searchParams.get("lang");
    const language =
      langParam === "th" || langParam === "en"
        ? langParam
        : detectLanguage(req.headers.get("accept-language") || "");
    return jsonOk(initialChatSession(language === "th" ? "th" : "en"));
  } catch (err) {
    return handleRouteError(err);
  }
}

/** Send a chat turn (new mission or clarification answer). */
export async function POST(req: NextRequest) {
  try {
    const session = await requireSession();
    const body = await req.json();
    const idempotencyHeader = req.headers.get("idempotency-key") ?? undefined;
    const parsed = ChatTurnRequestSchema.parse({
      ...body,
      idempotency_key: body.idempotency_key ?? idempotencyHeader,
    });
    const result = await handleChatTurn(parsed, session.actor);
    return jsonOk(result);
  } catch (err) {
    return handleRouteError(err);
  }
}
