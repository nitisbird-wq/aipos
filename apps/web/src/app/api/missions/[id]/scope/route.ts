import { NextRequest } from "next/server";
import { z } from "zod";
import { requireSession } from "@/lib/auth/session";
import { handleRouteError, jsonOk } from "@/lib/api/http";
import { ScopeClassificationSchema } from "@/lib/schemas/scope-guard";
import { listScopeLedger, registerScopeItem } from "@/lib/services/scope-guard";

type Ctx = { params: Promise<{ id: string }> };

const ScopeRequestSchema = z.object({
  title: z.string().min(1),
  description: z.string().min(1),
  classification: ScopeClassificationSchema,
  required_for_dod: z.boolean(),
  safety_required: z.boolean(),
  rationale: z.string().min(1),
  value: z.string().min(1),
  trigger: z.string().min(1).nullable().optional(),
  review_due_at: z.string().datetime().nullable().optional(),
  material_impact: z.object({
    time: z.boolean(),
    cost: z.boolean(),
    risk: z.boolean(),
    architecture: z.boolean(),
    detail: z.string().min(1).nullable(),
  }),
  wip_limit: z.number().int().positive().optional(),
});

export async function GET(_req: NextRequest, ctx: Ctx) {
  try {
    await requireSession();
    const { id } = await ctx.params;
    return jsonOk({ ok: true, scope: await listScopeLedger(id) });
  } catch (err) {
    return handleRouteError(err);
  }
}

export async function POST(req: NextRequest, ctx: Ctx) {
  try {
    const session = await requireSession();
    const { id } = await ctx.params;
    const body = ScopeRequestSchema.parse(await req.json());
    const item = await registerScopeItem({ missionId: id, actor: session.actor, ...body });
    return jsonOk({ ok: true, item }, { status: 201 });
  } catch (err) {
    return handleRouteError(err);
  }
}
