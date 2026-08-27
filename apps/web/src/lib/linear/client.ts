/**
 * Linear workstream dispatch adapter (Phase-2 style reconcile).
 * Default: mock. Live GraphQL only when LINEAR_ADAPTER=live + credentials.
 * Never treat chat as SoT; correlation_id is the idempotency key.
 */

export type LinearIssueRef = { id: string; title: string; identifier?: string };

export type LinearDispatchClient = {
  adapterName: "mock" | "live";
  searchByCorrelationId: (correlationId: string) => Promise<LinearIssueRef | null>;
  createWorkstreamIssue: (input: {
    correlationId: string;
    title: string;
    body: string;
  }) => Promise<LinearIssueRef>;
};

const CORRELATION_MARKER = (correlationId: string) => `correlation_id=${correlationId}`;

type MockStore = Map<string, LinearIssueRef>;

function getMockStore(): MockStore {
  const g = globalThis as { __aiposLinearMock?: MockStore };
  if (!g.__aiposLinearMock) g.__aiposLinearMock = new Map();
  return g.__aiposLinearMock;
}

export function createMockLinearClient(): LinearDispatchClient {
  const store = getMockStore();
  return {
    adapterName: "mock",
    async searchByCorrelationId(correlationId) {
      return store.get(correlationId) ?? null;
    },
    async createWorkstreamIssue(input) {
      const existing = store.get(input.correlationId);
      if (existing) return existing;
      const row: LinearIssueRef = {
        id: `mock-lin-${store.size + 1}`,
        title: input.title,
        identifier: `MOCK-${store.size + 1}`,
      };
      store.set(input.correlationId, row);
      return row;
    },
  };
}

async function linearGraphql<T>(
  apiKey: string,
  query: string,
  variables: Record<string, unknown>,
): Promise<T> {
  const res = await fetch("https://api.linear.app/graphql", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: apiKey,
    },
    body: JSON.stringify({ query, variables }),
  });
  if (!res.ok) {
    throw new Error(`LINEAR_HTTP_${res.status}`);
  }
  const json = (await res.json()) as { data?: T; errors?: Array<{ message: string }> };
  if (json.errors?.length) {
    throw new Error(`LINEAR_GQL: ${json.errors.map((e) => e.message).join("; ")}`);
  }
  if (!json.data) throw new Error("LINEAR_GQL_EMPTY");
  return json.data;
}

export function createLiveLinearClient(input: {
  apiKey: string;
  teamId: string;
}): LinearDispatchClient {
  const { apiKey, teamId } = input;
  return {
    adapterName: "live",
    async searchByCorrelationId(correlationId) {
      // Fail closed: any transport/parse error must throw (dispatcher catches → BLOCKED).
      const marker = CORRELATION_MARKER(correlationId);
      const data = await linearGraphql<{
        issueSearch: {
          nodes: Array<{
            id: string;
            title: string;
            identifier: string;
            description?: string | null;
          }>;
        };
      }>(
        apiKey,
        `query Search($term: String!) {
          issueSearch(query: $term, first: 10) {
            nodes { id title identifier description }
          }
        }`,
        { term: marker },
      );
      const exact = data.issueSearch.nodes.find(
        (n) => (n.description ?? "").includes(marker) || n.title.includes(correlationId),
      );
      if (!exact) return null;
      return { id: exact.id, title: exact.title, identifier: exact.identifier };
    },
    async createWorkstreamIssue(createInput) {
      const marker = CORRELATION_MARKER(createInput.correlationId);
      const description = `${createInput.body}\n\n${marker}\n_aipos_workstream_dispatch_`;
      const data = await linearGraphql<{
        issueCreate: {
          success: boolean;
          issue: { id: string; title: string; identifier: string } | null;
        };
      }>(
        apiKey,
        `mutation Create($input: IssueCreateInput!) {
          issueCreate(input: $input) {
            success
            issue { id title identifier }
          }
        }`,
        {
          input: {
            teamId,
            title: createInput.title.slice(0, 200),
            description,
          },
        },
      );
      if (!data.issueCreate.success || !data.issueCreate.issue) {
        throw new Error("LINEAR_CREATE_FAILED");
      }
      return {
        id: data.issueCreate.issue.id,
        title: data.issueCreate.issue.title,
        identifier: data.issueCreate.issue.identifier,
      };
    },
  };
}

/**
 * Resolve adapter from env. Live requires LINEAR_ADAPTER=live + LINEAR_API_KEY + LINEAR_TEAM_ID.
 * Fail closed to mock if live is misconfigured (never invent credentials).
 */
export function getLinearDispatchClient(): LinearDispatchClient {
  const mode = (process.env.LINEAR_ADAPTER || "mock").toLowerCase();
  if (mode === "live") {
    const apiKey = process.env.LINEAR_API_KEY?.trim();
    const teamId = process.env.LINEAR_TEAM_ID?.trim();
    if (!apiKey || !teamId) {
      throw new Error("LINEAR_LIVE_MISCONFIGURED: LINEAR_API_KEY and LINEAR_TEAM_ID required");
    }
    return createLiveLinearClient({ apiKey, teamId });
  }
  return createMockLinearClient();
}
