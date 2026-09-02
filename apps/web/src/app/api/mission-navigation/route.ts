import { NextRequest } from "next/server";
import { z } from "zod";
import { requireSession } from "@/lib/auth/session";
import { handleRouteError, jsonError, jsonOk } from "@/lib/api/http";
import {
  checkpointActiveMission,
  evaluateStaleMissionNavigation,
  getMissionNavigation,
  interruptMission,
  resolveInterruption,
  resumeMission,
  setPrimaryMission,
} from "@/lib/services/mission-navigation";

// prettier-ignore
const NavigationCommandSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("SET_PRIMARY"),
    workspace_id: z.string().min(1),
    mission_id: z.string().min(1),
    objective: z.string().min(1),
    definition_of_done: z.string().min(1),
    next_action: z.string().min(1),
  }),
  z.object({
    action: z.literal("CHECKPOINT"),
    workspace_id: z.string().min(1),
    summary: z.string().min(1),
    completed_outputs: z.array(z.string()),
    next_action: z.string().min(1),
    blockers: z.array(z.string()),
    idempotency_key: z.string().min(1),
  }),
  z.object({
    action: z.literal("INTERRUPT"),
    workspace_id: z.string().min(1),
    interruption_mission_id: z.string().min(1),
    classification: z.enum(["RELATED_IDEA", "SUBTASK", "URGENT_INTERRUPTION", "NEW_MISSION"]),
    reason: z.string().min(1),
    interruption_next_action: z.string().min(1),
  }),
  z.object({
    action: z.literal("RESOLVE_INTERRUPTION"),
    workspace_id: z.string().min(1),
    result: z.enum(["COMPLETED", "PARKED", "BLOCKED", "CANCELLED"]),
    summary: z.string().min(1),
  }),
]);

export async function GET(req: NextRequest) {
  try {
    await requireSession();
    const workspaceId = req.nextUrl.searchParams.get("workspace_id");
    if (!workspaceId) return jsonError("WORKSPACE_ID_REQUIRED", "workspace_id is required", 400);
    const state = await getMissionNavigation(workspaceId);
    if (!state) return jsonError("PRIMARY_MISSION_NOT_SET", "Primary mission not set", 404);
    return jsonOk({
      ok: true,
      state,
      resume: await resumeMission(workspaceId),
      stale: evaluateStaleMissionNavigation(state),
    });
  } catch (err) {
    return handleRouteError(err);
  }
}

// prettier-ignore
export async function POST(req: NextRequest) {
  try {
    const session = await requireSession();
    const command = NavigationCommandSchema.parse(await req.json());
    if (command.action === "SET_PRIMARY") {
      return jsonOk({
        ok: true,
        state: await setPrimaryMission({
          workspaceId: command.workspace_id,
          missionId: command.mission_id,
          objective: command.objective,
          definitionOfDone: command.definition_of_done,
          nextAction: command.next_action,
          actor: session.actor,
        }),
      });
    }
    if (command.action === "CHECKPOINT") {
      return jsonOk({
        ok: true,
        state: await checkpointActiveMission({
          workspaceId: command.workspace_id,
          summary: command.summary,
          completedOutputs: command.completed_outputs,
          nextAction: command.next_action,
          blockers: command.blockers,
          idempotencyKey: command.idempotency_key,
          actor: session.actor,
        }),
      });
    }
    if (command.action === "INTERRUPT") {
      return jsonOk({
        ok: true,
        state: await interruptMission({
          workspaceId: command.workspace_id,
          interruptionMissionId: command.interruption_mission_id,
          classification: command.classification,
          reason: command.reason,
          interruptionNextAction: command.interruption_next_action,
          actor: session.actor,
        }),
      });
    }
    return jsonOk({
      ok: true,
      ...(await resolveInterruption({
        workspaceId: command.workspace_id,
        result: command.result,
        summary: command.summary,
        actor: session.actor,
      })),
    });
  } catch (err) {
    return handleRouteError(err);
  }
}
