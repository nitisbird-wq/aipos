# Repository Structure

```text
aipos/
├── README.md
├── .env.example
├── .gitignore
├── docs/
│   ├── AIPOS_MVP_SCOPE.md
│   ├── AIPOS_ARCHITECTURE.md
│   ├── AIPOS_GOVERNANCE_RULES.md
│   ├── INTAKE_MISSION_BUNDLE_SCHEMA.md
│   ├── MISSION_OBJECT_SCHEMA.md
│   ├── NOTION_INTEGRATION_PLAN.md
│   ├── SECURITY_AND_PERMISSIONS.md
│   ├── ACCEPTANCE_CRITERIA.md
│   ├── IMPLEMENTATION_PLAN.md
│   ├── OPEN_QUESTIONS_AND_ASSUMPTIONS.md
│   ├── REPO_STRUCTURE.md          (this file mirrored)
│   ├── DATABASE_SCHEMA.md
│   ├── API_CONTRACT.md
│   ├── UI_FLOW.md
│   ├── TEST_STRATEGY.md
│   ├── DEPLOYMENT.md
│   └── RISK_REGISTER.md
├── packages/
│   └── schemas/
│       ├── intake-mission-bundle.schema.json
│       ├── mission-object.schema.json
│       └── policy.schema.json
├── data/
│   └── seeds/
│       ├── policies.json
│       └── capabilities.json
└── apps/
    └── web/                       # Next.js app (Phase B+)
```

Monorepo-ready; v0.1 may keep a single Next.js app at repo root later if preferred — structure above is the planned layout.
