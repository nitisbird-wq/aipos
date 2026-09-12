import { RecoverySchema, type RecoveryContract } from "@/lib/schemas/contracts";

export type RecoveryInput = {
  situation: string;
  behavior: string;
  impact: string;
  goal: string;
  reality: string;
  options: string[];
  will: string;
  preferred?: RecoveryContract["allowed_recovery"];
};

/**
 * Build a recovery.v1 plan using SBI + GROW.
 * Human escalation is last safe option unless preferred is ESCALATE.
 */
export function buildRecoveryPlan(input: RecoveryInput): RecoveryContract {
  const preferred = input.preferred ?? chooseRecovery(input.options);
  return RecoverySchema.parse({
    recovery_version: "recovery.v1",
    sbi: {
      situation: input.situation,
      behavior: input.behavior,
      impact: input.impact,
    },
    grow: {
      goal: input.goal,
      reality: input.reality,
      options: input.options,
      will: input.will,
    },
    allowed_recovery: preferred,
  });
}

function chooseRecovery(options: string[]): RecoveryContract["allowed_recovery"] {
  const joined = options.join(" ").toLowerCase();
  if (joined.includes("retry")) return "RETRY";
  if (joined.includes("reroute")) return "REROUTE";
  if (joined.includes("reconcile")) return "RECONCILE";
  if (joined.includes("rollback")) return "ROLLBACK";
  return "ESCALATE";
}

export function recoveryToWorkstreamObjective(plan: RecoveryContract): string {
  return [
    `SBI: ${plan.sbi.situation} / ${plan.sbi.behavior} / ${plan.sbi.impact}`,
    `GROW goal: ${plan.grow.goal}`,
    `Action: ${plan.allowed_recovery}`,
    `Will: ${plan.grow.will}`,
  ].join(" | ");
}
