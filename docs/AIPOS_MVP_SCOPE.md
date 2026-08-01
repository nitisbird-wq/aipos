# AIPOS Mission Intake MVP v0.1 — Scope

## Product

Responsive web application for **Mission Intake only**.

Flow in scope:

```text
User submits mission
→ System analyzes mission
→ System presents understanding
→ Draft Work Map
→ Operational risk + sensitivity
→ Missing blockers
→ User confirms or corrects
→ Mission Object created
→ Mission recorded in Notion (verified)
→ Mission status = ready
```

## In scope

- Screens: Intake, Understanding, Dashboard, Detail, Governance (read-only)
- IntakeMissionBundle + Readiness / Handling / Mapping gates
- Mission Object after confirmation
- Policy Registry (seed + viewer)
- Capability Registry seed (no auto-routing)
- App database (runtime) + Notion Mission Registry projection
- Audit log for transitions
- Responsive UI (desktop, iPad, mobile browser)
- Deploy target: Vercel; repo: GitHub

## Out of scope (v0.1)

- Real specialist execution (Claude, Cursor, Gemini, Canva, Gamma, Adobe, …)
- Planning → real Subtask creation
- Capability Matching / Assignment automation
- n8n production bootstrap
- Multi-channel intake beyond web app (ChatGPT Actions = Phase 0.2)
- Full PWA (optional later if low effort)
- Admin policy editor UI (seed + RO viewer only)

## Non-negotiable separations

| Layer | Role in MVP |
|---|---|
| Web Intake UI | Human-facing intake |
| AIPOS Core (thin) | Gates, mapping, audit, Notion sync |
| Notion | Mission Registry / Digital Brain projection |
| Specialists | Not invoked |

ChatGPT and Notion must **not** become the permanent Mission Orchestrator.
