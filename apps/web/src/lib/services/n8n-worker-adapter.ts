/**
 * Stage 7D — n8n Worker Adapter
 *
 * Authority: ADR-007 D-007.6 Option B — L1 (control-plane writes via authorized adapter).
 * Workers MUST NOT write Linear/Notion/DB directly.
 * All state writes go through reconcileRuntimeAfterExternalAction().
 *
 * Live mode requires:
 *   N8N_ADAPTER=live
 *   N8N_STAGING_WEBHOOK_URL=<staging webhook URL>
 *   N8N_STAGING_WEBHOOK_SECRET=<optional HMAC secret>
 */

export type N8nWorkerInput = {
  mission_id: string;
  workstream_id: string;
  correlation_id: string;
  action_type: string;
  payload?: Record<string, unknown>;
};

export type N8nWorkerOutput = {
  ok: boolean;
  correlation_id: string;
  mission_id: string;
  workstream_id: string;
  result_artifact: string | null;
  worker_authority: string;
  executed_at: string;
  note: string;
  error?: string;
};

export type N8nWorkerAdapter = {
  adapterName: "mock" | "live";
  trigger: (input: N8nWorkerInput) => Promise<N8nWorkerOutput>;
};

type MockConfig = {
  forceFailure?: boolean;
  failureError?: string;
};

export function createMockN8nWorkerAdapter(config: MockConfig = {}): N8nWorkerAdapter {
  return {
    adapterName: "mock",
    async trigger(input) {
      const now = new Date().toISOString();
      if (config.forceFailure) {
        return {
          ok: false,
          correlation_id: input.correlation_id,
          mission_id: input.mission_id,
          workstream_id: input.workstream_id,
          result_artifact: null,
          worker_authority: "L1",
          executed_at: now,
          note: "AIPOS Stage 7D STAGING — synthetic failure",
          error: config.failureError ?? "STAGING_WORKER_FAILURE",
        };
      }
      return {
        ok: true,
        correlation_id: input.correlation_id,
        mission_id: input.mission_id,
        workstream_id: input.workstream_id,
        result_artifact: `staging://${input.mission_id}/${input.workstream_id}/${input.correlation_id}`,
        worker_authority: "L1",
        executed_at: now,
        note: "AIPOS Stage 7D STAGING — synthetic result for E2E proof, not real worker output",
      };
    },
  };
}

export function createLiveN8nWorkerAdapter(webhookUrl: string): N8nWorkerAdapter {
  return {
    adapterName: "live",
    async trigger(input) {
      const res = await fetch(webhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: input }),
      });
      if (!res.ok) {
        throw new Error(`N8N_HTTP_${res.status}: staging webhook returned ${res.status}`);
      }
      const json = (await res.json()) as N8nWorkerOutput;
      return json;
    },
  };
}

export function getN8nWorkerAdapter(): N8nWorkerAdapter {
  const mode = (process.env.N8N_ADAPTER ?? "mock").toLowerCase();
  if (mode === "live") {
    const url = process.env.N8N_STAGING_WEBHOOK_URL?.trim();
    if (!url) {
      throw new Error(
        "N8N_LIVE_MISCONFIGURED: N8N_STAGING_WEBHOOK_URL required when N8N_ADAPTER=live",
      );
    }
    return createLiveN8nWorkerAdapter(url);
  }
  return createMockN8nWorkerAdapter();
}
