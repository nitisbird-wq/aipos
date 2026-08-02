const BASE = process.env.BASE_URL || "http://127.0.0.1:3000";
const jar = new Map<string, string>();

function store(res: Response) {
  for (const line of res.headers.getSetCookie?.() ?? []) {
    const pair = line.split(";")[0];
    const i = pair.indexOf("=");
    jar.set(pair.slice(0, i), pair.slice(i + 1));
  }
}

async function req(path: string, init: RequestInit = {}) {
  const headers = new Headers(init.headers);
  if (jar.size) headers.set("cookie", [...jar].map(([k, v]) => `${k}=${v}`).join("; "));
  if (init.body && !headers.has("content-type")) headers.set("content-type", "application/json");
  const res = await fetch(`${BASE}${path}`, { ...init, headers });
  store(res);
  return { res, json: await res.json() };
}

async function main() {
  await req("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ email: "operator@example.com", password: "dev-password" }),
  });

  const turn = await req("/api/chat", {
    method: "POST",
    headers: { "Idempotency-Key": `TH-${Date.now()}` },
    body: JSON.stringify({
      message: "ต้องการสรุปคู่มือรับภารกิจสำหรับทีมปฏิบัติการ เป็นภาษาไทย",
    }),
  });

  const draft = turn.json.draft;
  const thaiRe = /[\u0E00-\u0E7F]/;
  const checks = {
    state: turn.json.conversation_state,
    language: draft?.language,
    summary_th: thaiRe.test(draft?.mission_summary || ""),
    outcome_th: thaiRe.test(draft?.desired_outcome || ""),
    criteria_th: thaiRe.test((draft?.success_criteria || []).join(" ")),
    no_en_boilerplate: !/^Deliver a confirmed/i.test(draft?.desired_outcome || ""),
    summary: draft?.mission_summary,
    criteria0: draft?.success_criteria?.[0],
  };
  console.log(JSON.stringify(checks, null, 2));

  let body = turn.json;
  while ((body.clarifications?.length ?? 0) > 0) {
    const c = body.clarifications[0];
    const next = await req("/api/chat", {
      method: "POST",
      body: JSON.stringify({
        message: c.suggestions[0],
        intake_id: body.intake_id,
        clarification_code: c.code,
      }),
    });
    body = next.json;
  }

  const confirmed = await req("/api/chat/confirm", {
    method: "POST",
    body: JSON.stringify({
      intake_id: body.intake_id,
      sensitivity_acknowledged: true,
    }),
  });
  console.log(
    JSON.stringify(
      {
        confirm_ok: confirmed.json.ok,
        mission_id: confirmed.json.mission_id,
        notion: confirmed.json.notion?.sync_status,
      },
      null,
      2,
    ),
  );

  if (
    !checks.summary_th ||
    !checks.outcome_th ||
    !checks.criteria_th ||
    !checks.no_en_boilerplate
  ) {
    process.exitCode = 1;
  }
  if (!confirmed.json.ok) process.exitCode = 1;
}

main();
