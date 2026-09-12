import { NextRequest } from "next/server";
import { z } from "zod";
import { requireSession } from "@/lib/auth/session";
import { handleRouteError, jsonOk } from "@/lib/api/http";
import {
  CapabilityOperatorSchema,
  CapabilityTestOutcomeSchema,
  CapabilityTruthStatusSchema,
} from "@/lib/schemas/capability-registry";
import {
  listCapabilityRegistry,
  saveCapabilityRegistryEntry,
} from "@/lib/services/capability-registry";

const SaveCapabilityRequestSchema = z.object({
  capability_id: z.string().min(1),
  family: z.string().min(1),
  name: z.string().min(1),
  description: z.string().min(1),
  status: CapabilityTruthStatusSchema,
  enabled: z.boolean(),
  operators: z.array(CapabilityOperatorSchema),
  tools: z.array(z.string()),
  evidence_refs: z.array(z.string()),
  verified_at: z.string().datetime().nullable().optional(),
  expires_at: z.string().datetime().nullable().optional(),
  retest_due_at: z.string().datetime().nullable().optional(),
  last_test_outcome: CapabilityTestOutcomeSchema.optional(),
  downgrade_reason: z.string().min(1).nullable().optional(),
});

export async function GET() {
  try {
    await requireSession();
    return jsonOk({ ok: true, capabilities: await listCapabilityRegistry() });
  } catch (err) {
    return handleRouteError(err);
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await requireSession();
    const body = SaveCapabilityRequestSchema.parse(await req.json());
    const capability = await saveCapabilityRegistryEntry({ ...body, actor: session.actor });
    return jsonOk({ ok: true, capability }, { status: 201 });
  } catch (err) {
    return handleRouteError(err);
  }
}
