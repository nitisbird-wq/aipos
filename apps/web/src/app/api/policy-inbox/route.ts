import { NextRequest } from "next/server";
import { z } from "zod";
import { requireSession } from "@/lib/auth/session";
import { handleRouteError, jsonOk } from "@/lib/api/http";
import {
  PolicyCandidateKindSchema,
  PolicyCanonicalTargetSchema,
} from "@/lib/schemas/policy-inbox";
import {
  buildPolicyCoverageReport,
  capturePolicyCandidate,
  listPolicyCandidates,
} from "@/lib/services/policy-inbox";

// prettier-ignore
const CapturePolicyRequestSchema = z.object({
  kind: PolicyCandidateKindSchema,
  title: z.string().min(1),
  statement: z.string().min(1),
  scope: z.string().min(1),
  priority: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]),
  confidence: z.number().min(0).max(1),
  source_channel: z.string().min(1),
  source_ref: z.string().min(1),
  source_quote: z.string().min(1).nullable().optional(),
  effective_at: z.string().datetime().nullable().optional(),
  review_due_at: z.string().datetime().nullable().optional(),
  proposed_target: PolicyCanonicalTargetSchema,
  conflicts_with: z.array(z.string()).optional(),
  supersedes: z.array(z.string()).optional(),
});

// prettier-ignore
export async function GET() {
  try {
    await requireSession();
    const candidates = await listPolicyCandidates();
    const expectedChannels = (process.env.AIPOS_EXPECTED_POLICY_CHANNELS ||
      "chatgpt,claude,notion,github,linear,n8n")
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean);
    const connectedChannels = (process.env.AIPOS_CONNECTED_POLICY_CHANNELS || "")
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean);
    return jsonOk({
      ok: true,
      candidates,
      coverage: buildPolicyCoverageReport({
        expectedChannels,
        connectedChannels,
        candidates,
      }),
    });
  } catch (err) {
    return handleRouteError(err);
  }
}

// prettier-ignore
export async function POST(req: NextRequest) {
  try {
    const session = await requireSession();
    const body = CapturePolicyRequestSchema.parse(await req.json());
    const candidate = await capturePolicyCandidate({ ...body, actor: session.actor });
    return jsonOk({ ok: true, candidate }, { status: 201 });
  } catch (err) {
    return handleRouteError(err);
  }
}
