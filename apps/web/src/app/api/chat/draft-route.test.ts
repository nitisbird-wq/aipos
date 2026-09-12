import { afterEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { AuthError, requireSession } from "@/lib/auth/session";
import { correctChatDraft, resumeChatIntake } from "@/lib/services/chat-intake-service";
import { GET, PATCH } from "./route";

vi.mock("@/lib/auth/session", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/lib/auth/session")>();
  return { ...original, requireSession: vi.fn() };
});
vi.mock("@/lib/services/chat-intake-service", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/lib/services/chat-intake-service")>();
  return { ...original, correctChatDraft: vi.fn(), resumeChatIntake: vi.fn() };
});
afterEach(() => vi.resetAllMocks());
const request = () =>
  new NextRequest("http://localhost/api/chat", {
    method: "PATCH",
    body: JSON.stringify({ intake_id: "INT-TEST" }),
  });
describe("Draft API authentication and conflict responses", () => {
  it("rejects unauthenticated correction before invoking service", async () => {
    vi.mocked(requireSession).mockRejectedValue(new AuthError("Unauthorized"));
    expect((await PATCH(request())).status).toBe(401);
    expect(correctChatDraft).not.toHaveBeenCalled();
  });
  it("rejects unauthenticated resume without reading draft", async () => {
    vi.mocked(requireSession).mockRejectedValue(new AuthError("Unauthorized"));
    expect(
      (await GET(new NextRequest("http://localhost/api/chat?intake_id=INT-TEST"))).status,
    ).toBe(401);
    expect(resumeChatIntake).not.toHaveBeenCalled();
  });
  it("reports stale correction as conflict using authenticated actor", async () => {
    vi.mocked(requireSession).mockResolvedValue({
      email: "test@example.com",
      name: "Test",
      actor: "operator:test",
      issued_at: "test",
    });
    vi.mocked(correctChatDraft).mockRejectedValue(new Error("INTAKE_STALE"));
    const response = await PATCH(request());
    expect(response.status).toBe(409);
    expect(correctChatDraft).toHaveBeenCalledWith({ intake_id: "INT-TEST" }, "operator:test");
  });
  it("reports missing saved draft without silently creating a welcome session", async () => {
    vi.mocked(requireSession).mockResolvedValue({
      email: "test@example.com",
      name: "Test",
      actor: "operator:test",
      issued_at: "test",
    });
    vi.mocked(resumeChatIntake).mockRejectedValue(new Error("INTAKE_NOT_FOUND"));
    expect(
      (await GET(new NextRequest("http://localhost/api/chat?intake_id=INT-MISSING"))).status,
    ).toBe(404);
  });
});
