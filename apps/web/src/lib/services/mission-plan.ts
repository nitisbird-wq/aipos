import { nowIso } from "@/lib/ids";
import { decomposeMissionStrategy } from "@/lib/services/decomposer";
import {
  getMissionControlState,
  upsertMissionControlState,
} from "@/lib/services/control-plane-state";
import {
  OutcomeWorkstreamSchema,
  OwnerQuestionSchema,
  PlanReviewStateSchema,
  type MissionStrategy,
  type OutcomeWorkstream,
  type OwnerQuestion,
  type PlanReviewState,
  type WorkstreamApprovalState,
} from "@/lib/schemas/contracts";
import { z } from "zod";

const UNIVERSAL_QUESTIONS: Omit<OwnerQuestion, "answer">[] = [
  {
    id: "Q-01",
    question: "What does success look like when this mission is complete? Any specific outcomes?",
    required: true,
  },
  {
    id: "Q-02",
    question: "Are there deadlines or time constraints I should plan around?",
    required: false,
  },
  {
    id: "Q-03",
    question: "Who reviews and accepts the final deliverable?",
    required: true,
  },
  {
    id: "Q-04",
    question: "Are there existing resources, prior work, or reference materials to incorporate?",
    required: false,
  },
  {
    id: "Q-05",
    question: "What is the preferred format or medium for the deliverable?",
    required: false,
  },
];

const PLAYBOOK_QUESTIONS: Record<string, Omit<OwnerQuestion, "answer">[]> = {
  research: [
    { id: "Q-06", question: "Which sources or databases should be prioritized?", required: false },
    { id: "Q-07", question: "Are there any sources or domains to avoid?", required: false },
    {
      id: "Q-08",
      question: "What confidence level is required before the findings are final?",
      required: false,
    },
    {
      id: "Q-09",
      question: "Should research surface competing viewpoints, or focus on a single thesis?",
      required: false,
    },
    {
      id: "Q-10",
      question: "Who is the audience — internal team, executives, or external stakeholders?",
      required: true,
    },
  ],
  software_build: [
    {
      id: "Q-06",
      question: "What is the target environment — dev, staging, or production?",
      required: true,
    },
    {
      id: "Q-07",
      question: "Are there code review or approval requirements before merge?",
      required: false,
    },
    {
      id: "Q-08",
      question: "Which existing services or APIs must this integrate with?",
      required: false,
    },
    { id: "Q-09", question: "Are there performance or SLA requirements?", required: false },
    {
      id: "Q-10",
      question: "Should tests be written before implementation (TDD) or after?",
      required: false,
    },
  ],
  debug: [
    {
      id: "Q-06",
      question: "Can you share the exact error message or stack trace?",
      required: true,
    },
    {
      id: "Q-07",
      question: "When did this issue first appear? Any recent changes?",
      required: false,
    },
    {
      id: "Q-08",
      question: "Is this blocking production, or a staging/dev issue?",
      required: true,
    },
    { id: "Q-09", question: "Are there other systems affected by this failure?", required: false },
    { id: "Q-10", question: "Has a rollback or workaround been attempted?", required: false },
  ],
  automation: [
    {
      id: "Q-06",
      question: "What triggers this workflow — schedule, webhook, or manual?",
      required: true,
    },
    {
      id: "Q-07",
      question: "What should happen when the workflow fails — retry, alert, or skip?",
      required: true,
    },
    {
      id: "Q-08",
      question: "Who monitors and receives alerts for this automation?",
      required: false,
    },
    {
      id: "Q-09",
      question: "Are there rate limits or API quotas that constrain execution?",
      required: false,
    },
    {
      id: "Q-10",
      question: "How should sensitive data be handled within the workflow?",
      required: false,
    },
  ],
  decision: [
    { id: "Q-06", question: "Who has final authority to make this decision?", required: true },
    {
      id: "Q-07",
      question: "What is the risk tolerance — conservative, balanced, or aggressive?",
      required: true,
    },
    {
      id: "Q-08",
      question: "Are there options or approaches you've already ruled out?",
      required: false,
    },
    { id: "Q-09", question: "Is there a fixed deadline for this decision?", required: false },
    {
      id: "Q-10",
      question: "Should the decision brief remain internal or be shared with stakeholders?",
      required: false,
    },
  ],
  knowledge_organization: [
    { id: "Q-06", question: "What taxonomy or tagging system should be applied?", required: false },
    {
      id: "Q-07",
      question: "Who will maintain this knowledge base after the mission?",
      required: false,
    },
    {
      id: "Q-08",
      question: "Are there access restrictions on any of the source material?",
      required: false,
    },
    {
      id: "Q-09",
      question: "Should outdated or superseded pages be archived or deleted?",
      required: false,
    },
    {
      id: "Q-10",
      question: "What is the target tool or platform for the final structure?",
      required: true,
    },
  ],
  business_launch: [
    { id: "Q-06", question: "What is the target market segment for this launch?", required: true },
    {
      id: "Q-07",
      question: "Are there regulatory or compliance requirements for this launch?",
      required: false,
    },
    { id: "Q-08", question: "What is the go/no-go criteria for proceeding?", required: true },
    {
      id: "Q-09",
      question: "Who are the key stakeholders that must sign off before launch?",
      required: false,
    },
    {
      id: "Q-10",
      question: "What is the contingency plan if the launch does not meet targets?",
      required: false,
    },
  ],
  creative_synthesis: [
    {
      id: "Q-06",
      question: "Are there brand guidelines or creative constraints to respect?",
      required: false,
    },
    {
      id: "Q-07",
      question: "How many concept directions should be explored before selection?",
      required: false,
    },
    { id: "Q-08", question: "Who provides creative direction approval?", required: true },
    {
      id: "Q-09",
      question: "What file formats are required for the final deliverable?",
      required: false,
    },
    {
      id: "Q-10",
      question: "Should the creative package include usage documentation?",
      required: false,
    },
  ],
  investigation: [
    {
      id: "Q-06",
      question: "What signals or data sources are available to start the investigation?",
      required: false,
    },
    {
      id: "Q-07",
      question: "What is the escalation path if the investigation is inconclusive?",
      required: true,
    },
    {
      id: "Q-08",
      question: "Is there a hypothesis to validate, or is this open-ended?",
      required: false,
    },
    {
      id: "Q-09",
      question: "Are there time or resource limits on the investigation scope?",
      required: false,
    },
    { id: "Q-10", question: "Who needs to be notified when findings are ready?", required: false },
  ],
};

function generateOwnerQuestions(strategy: MissionStrategy): OwnerQuestion[] {
  const playbookQs =
    PLAYBOOK_QUESTIONS[strategy.selected_playbook] ?? PLAYBOOK_QUESTIONS["investigation"]!;
  return [...UNIVERSAL_QUESTIONS, ...playbookQs].map((q) =>
    OwnerQuestionSchema.parse({ ...q, answer: null }),
  );
}

function planId(missionId: string): string {
  return `PLAN-${missionId}`;
}

function transitionApprovalState(workstreams: OutcomeWorkstream[]): OutcomeWorkstream[] {
  const allApproved = workstreams.every((ws) => ws.approval_state !== "PROPOSED");
  if (!allApproved) return workstreams;
  return workstreams.map((ws) =>
    ws.approval_state === "APPROVED"
      ? OutcomeWorkstreamSchema.parse({ ...ws, approval_state: "DISPATCHABLE" })
      : ws,
  );
}

export async function generateMissionPlan(input: {
  missionId: string;
  strategy: MissionStrategy;
  actor: string;
}): Promise<PlanReviewState> {
  const rawWorkstreams = decomposeMissionStrategy(input.strategy);
  const workstreams = rawWorkstreams.map((ws) =>
    OutcomeWorkstreamSchema.parse({ ...ws, approval_state: "PROPOSED", owner_notes: "" }),
  );
  const ownerQuestions = generateOwnerQuestions(input.strategy);
  const now = nowIso();
  const plan = PlanReviewStateSchema.parse({
    plan_id: planId(input.missionId),
    mission_id: input.missionId,
    strategy_id: input.strategy.strategy_id,
    workstreams,
    owner_questions: ownerQuestions,
    review_status: "PENDING_REVIEW",
    created_at: now,
    updated_at: now,
  });
  await upsertMissionControlState(input.missionId, input.actor, {
    plan_review: plan,
    mission_state: "PLANNED",
    next_action: "Owner review of mission plan",
    responsible: "mission_owner",
  });
  return plan;
}

export async function getPlanReviewState(missionId: string): Promise<PlanReviewState | null> {
  const state = await getMissionControlState(missionId);
  return state.plan_review ?? null;
}

async function mutatePlan(
  missionId: string,
  actor: string,
  mutate: (plan: PlanReviewState) => PlanReviewState,
): Promise<PlanReviewState> {
  const state = await getMissionControlState(missionId);
  if (!state.plan_review) throw new Error("PLAN_NOT_FOUND");
  const updated = mutate(state.plan_review);
  const next = PlanReviewStateSchema.parse({ ...updated, updated_at: nowIso() });
  await upsertMissionControlState(missionId, actor, { plan_review: next });
  return next;
}

function applyAllApproved(plan: PlanReviewState): PlanReviewState {
  const allApproved = plan.workstreams.every((ws) => ws.approval_state !== "PROPOSED");
  const review_status: PlanReviewState["review_status"] = allApproved ? "APPROVED" : "IN_REVIEW";
  const workstreams = allApproved ? transitionApprovalState(plan.workstreams) : plan.workstreams;
  return { ...plan, workstreams, review_status };
}

export async function approvePlanWorkstream(
  missionId: string,
  workstreamId: string,
  actor: string,
): Promise<PlanReviewState> {
  return mutatePlan(missionId, actor, (plan) => {
    const workstreams = plan.workstreams.map((ws) =>
      ws.workstream_id === workstreamId && ws.approval_state === "PROPOSED"
        ? OutcomeWorkstreamSchema.parse({ ...ws, approval_state: "APPROVED" })
        : ws,
    );
    return applyAllApproved({ ...plan, workstreams });
  });
}

const EditWorkstreamPatchSchema = z.object({
  title: z.string().min(1).optional(),
  objective: z.string().min(1).optional(),
  owner_notes: z.string().optional(),
  risk_level: z.enum(["L0", "L1", "L2", "L3", "L4"]).optional(),
  acceptance_criteria: z.array(z.string().min(1)).min(1).optional(),
  required_capabilities: z.array(z.string().min(1)).min(1).optional(),
  approval_required: z.boolean().optional(),
});
export type EditWorkstreamPatch = z.infer<typeof EditWorkstreamPatchSchema>;

export async function editPlanWorkstream(
  missionId: string,
  workstreamId: string,
  patch: EditWorkstreamPatch,
  actor: string,
): Promise<PlanReviewState> {
  const validated = EditWorkstreamPatchSchema.parse(patch);
  return mutatePlan(missionId, actor, (plan) => {
    const workstreams = plan.workstreams.map((ws) =>
      ws.workstream_id === workstreamId
        ? OutcomeWorkstreamSchema.parse({ ...ws, ...validated, approval_state: "PROPOSED" })
        : ws,
    );
    return { ...plan, workstreams, review_status: "IN_REVIEW" };
  });
}

export async function removePlanWorkstream(
  missionId: string,
  workstreamId: string,
  actor: string,
): Promise<PlanReviewState> {
  return mutatePlan(missionId, actor, (plan) => {
    if (plan.workstreams.length <= 1) throw new Error("CANNOT_REMOVE_LAST_WORKSTREAM");
    const workstreams = plan.workstreams.filter((ws) => ws.workstream_id !== workstreamId);
    return applyAllApproved({ ...plan, workstreams });
  });
}

const AddWorkstreamDraftSchema = z.object({
  title: z.string().min(1),
  objective: z.string().min(1),
  reason_required: z.string().min(1),
  inputs: z.array(z.string()).default([]),
  expected_output: z.array(z.string().min(1)).min(1),
  acceptance_criteria: z.array(z.string().min(1)).min(1),
  required_capabilities: z.array(z.string().min(1)).min(1),
  risk_level: z.enum(["L0", "L1", "L2", "L3", "L4"]),
  approval_required: z.boolean(),
  parallelizable: z.boolean().default(false),
  dependencies: z.array(z.string()).default([]),
  owner_notes: z.string().default(""),
});
export type AddWorkstreamDraft = z.input<typeof AddWorkstreamDraftSchema>;

export async function addPlanWorkstream(
  missionId: string,
  draft: AddWorkstreamDraft,
  actor: string,
): Promise<PlanReviewState> {
  const validated = AddWorkstreamDraftSchema.parse(draft);
  return mutatePlan(missionId, actor, (plan) => {
    const maxOrder = plan.workstreams.reduce((m, ws) => Math.max(m, ws.execution_order), 0);
    const newWsId = `${missionId}-WS-CUSTOM-${Date.now()}`;
    const newWs = OutcomeWorkstreamSchema.parse({
      ...validated,
      workstream_id: newWsId,
      mission_id: missionId,
      execution_order: maxOrder + 1,
      status: "pending",
      approval_state: "PROPOSED",
    });
    return { ...plan, workstreams: [...plan.workstreams, newWs], review_status: "IN_REVIEW" };
  });
}

export async function approveAllPlan(missionId: string, actor: string): Promise<PlanReviewState> {
  return mutatePlan(missionId, actor, (plan) => {
    const allApproved = plan.workstreams.map((ws) =>
      OutcomeWorkstreamSchema.parse({ ...ws, approval_state: "APPROVED" }),
    );
    return applyAllApproved({ ...plan, workstreams: allApproved });
  });
}

export async function answerOwnerQuestion(
  missionId: string,
  questionId: string,
  answer: string,
  actor: string,
): Promise<PlanReviewState> {
  return mutatePlan(missionId, actor, (plan) => {
    const owner_questions = plan.owner_questions.map((q) =>
      q.id === questionId ? OwnerQuestionSchema.parse({ ...q, answer }) : q,
    );
    return { ...plan, owner_questions };
  });
}

export async function regeneratePlan(input: {
  missionId: string;
  strategy: MissionStrategy;
  actor: string;
}): Promise<PlanReviewState> {
  return generateMissionPlan(input);
}

export function dispatchableWorkstreams(plan: PlanReviewState): OutcomeWorkstream[] {
  return plan.workstreams.filter((ws) => ws.approval_state === "DISPATCHABLE");
}
