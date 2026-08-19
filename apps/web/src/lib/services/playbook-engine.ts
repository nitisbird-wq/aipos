export type Playbook = {
  id:
    | "research"
    | "decision"
    | "software_build"
    | "debug"
    | "automation"
    | "investigation"
    | "knowledge_organization"
    | "business_launch"
    | "creative_synthesis";
  guidance: string[];
};

const PLAYBOOKS: Record<Playbook["id"], Playbook> = {
  research: {
    id: "research",
    guidance: ["Frame hypotheses", "Gather sources", "Synthesize findings", "Validate confidence"],
  },
  decision: {
    id: "decision",
    guidance: ["Define decision objective", "Compare options", "Assess risk", "Recommend choice"],
  },
  software_build: {
    id: "software_build",
    guidance: ["Define behavior", "Implement incrementally", "Verify with tests", "Document impact"],
  },
  debug: {
    id: "debug",
    guidance: ["Reproduce issue", "Gather runtime evidence", "Fix root cause", "Regression test"],
  },
  automation: {
    id: "automation",
    guidance: ["Define trigger", "Model workflow", "Validate handlers", "Plan recovery path"],
  },
  investigation: {
    id: "investigation",
    guidance: ["Collect signals", "Test assumptions", "Document findings", "Escalate unresolved risks"],
  },
  knowledge_organization: {
    id: "knowledge_organization",
    guidance: ["Normalize taxonomy", "Structure references", "Link evidence", "Plan update cadence"],
  },
  business_launch: {
    id: "business_launch",
    guidance: ["Define market objective", "Build launch plan", "Set success metrics", "Prepare go/no-go gate"],
  },
  creative_synthesis: {
    id: "creative_synthesis",
    guidance: ["Gather inspirations", "Draft concepts", "Iterate with constraints", "Finalize presentation"],
  },
};

export function getPlaybook(playbookId: Playbook["id"]): Playbook {
  return PLAYBOOKS[playbookId];
}
