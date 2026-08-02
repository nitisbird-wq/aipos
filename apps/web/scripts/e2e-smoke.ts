/**
 * Local E2E smoke: login → chat mission → clarify if needed → confirm → mission detail
 * Run: npx tsx scripts/e2e-smoke.ts
 */
const BASE = process.env.BASE_URL || "http://127.0.0.1:3000";

type Jar = Map<string, string>;

function storeCookies(jar: Jar, res: Response) {
  const raw = res.headers.getSetCookie?.() ?? [];
  for (const line of raw) {
    const [pair] = line.split(";");
    const idx = pair.indexOf("=");
    if (idx > 0) jar.set(pair.slice(0, idx), pair.slice(idx + 1));
  }
}

function cookieHeader(jar: Jar): string {
  return Array.from(jar.entries())
    .map(([k, v]) => `${k}=${v}`)
    .join("; ");
}

async function req(
  jar: Jar,
  path: string,
  init: RequestInit = {},
): Promise<{ res: Response; json: any }> {
  const headers = new Headers(init.headers);
  if (jar.size) headers.set("cookie", cookieHeader(jar));
  if (init.body && !headers.has("content-type")) {
    headers.set("content-type", "application/json");
  }
  const res = await fetch(`${BASE}${path}`, { ...init, headers });
  storeCookies(jar, res);
  const text = await res.text();
  let json: any = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = { raw: text };
  }
  return { res, json };
}

async function main() {
  const jar: Jar = new Map();
  const log = (step: string, ok: boolean, extra?: unknown) => {
    console.log(`${ok ? "OK" : "FAIL"}  ${step}${extra ? ` — ${JSON.stringify(extra)}` : ""}`);
    if (!ok) process.exitCode = 1;
  };

  // 1. Login
  {
    const { res, json } = await req(jar, "/api/auth/login", {
      method: "POST",
      body: JSON.stringify({
        email: "operator@example.com",
        password: "dev-password",
      }),
    });
    log("login", res.ok && json?.ok === true, { status: res.status });
  }

  // 2. Session
  {
    const { res, json } = await req(jar, "/api/auth/session");
    log("session", res.ok && json?.authenticated === true, {
      email: json?.email,
      persistence: json?.persistence_mode,
    });
  }

  // 3. Chat welcome
  {
    const { res, json } = await req(jar, "/api/chat");
    log("chat welcome", res.ok && json?.conversation_state === "awaiting_mission", {
      state: json?.conversation_state,
      msgs: json?.messages?.length,
    });
  }

  // 4. Submit mission (simple English → likely awaiting_confirmation)
  let intakeId: string | null = null;
  let state = "";
  {
    const { res, json } = await req(jar, "/api/chat", {
      method: "POST",
      headers: { "Idempotency-Key": `E2E-${Date.now()}` },
      body: JSON.stringify({
        message:
          "Create a short onboarding checklist for the support team. Output as a markdown checklist.",
      }),
    });
    intakeId = json?.intake_id ?? null;
    state = json?.conversation_state;
    log("chat mission turn", res.ok && !!intakeId, {
      intake_id: intakeId,
      state,
      clarifications: json?.clarifications?.length ?? 0,
      criteria: json?.draft?.success_criteria?.slice?.(0, 1),
    });

    // Resolve clarifications if any
    let guard = 0;
    while (json && (json.clarifications?.length ?? 0) > 0 && intakeId && guard < 5) {
      guard += 1;
      const c = json.clarifications[0];
      const answer = c.suggestions?.[0] || "continue";
      const next = await req(jar, "/api/chat", {
        method: "POST",
        body: JSON.stringify({
          message: answer,
          intake_id: intakeId,
          clarification_code: c.code,
        }),
      });
      Object.assign(json, next.json);
      state = next.json?.conversation_state;
      log(`clarify ${c.code}`, next.res.ok, {
        state,
        remaining: next.json?.clarifications?.length,
      });
    }
  }

  if (!intakeId) {
    console.error("No intake_id — abort");
    process.exit(1);
  }

  // 5. Confirm
  let missionId: string | null = null;
  {
    const { res, json } = await req(jar, "/api/chat/confirm", {
      method: "POST",
      body: JSON.stringify({
        intake_id: intakeId,
        sensitivity_acknowledged: true,
      }),
    });
    missionId = json?.mission_id ?? null;
    log("confirm → mission", res.ok && json?.ok === true && !!missionId, {
      mission_id: missionId,
      status: json?.status,
      notion: json?.notion?.sync_status,
      message: json?.notion?.message,
      error: json?.error,
    });
  }

  if (!missionId) {
    console.error("No mission_id — abort");
    process.exit(1);
  }

  // 6. Mission detail
  {
    const { res, json } = await req(jar, `/api/missions/${missionId}`);
    log("mission detail", res.ok && json?.mission?.status === "ready", {
      status: json?.mission?.status,
      subtasks: json?.mission?.subtask_ids,
      notion: json?.notion_sync?.sync_status,
      owner_request_len: json?.intake?.raw_request?.length,
    });
  }

  // 7. Invalid transition from ready
  {
    const { res, json } = await req(jar, `/api/missions/${missionId}/transitions`, {
      method: "POST",
      body: JSON.stringify({ command: "unblock", reason: "e2e invalid" }),
    });
    log("reject unblock from ready", res.status === 422 && json?.ok === false, {
      code: json?.code,
      message: json?.message,
    });
  }

  // 8. Retry rejected from mock_synced
  {
    const { res, json } = await req(jar, `/api/missions/${missionId}/notion/retry`, {
      method: "POST",
      body: JSON.stringify({}),
    });
    log("reject retry from mock_synced", res.status === 422 && json?.ok === false, {
      code: json?.code || json?.error?.code,
      sync: json?.sync_status,
    });
  }

  // 9. Pages load
  for (const path of ["/intake", "/missions", `/missions/${missionId}`, "/governance"]) {
    const { res } = await req(jar, path);
    log(`page ${path}`, res.ok, { status: res.status });
  }

  console.log("\nE2E smoke finished.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
