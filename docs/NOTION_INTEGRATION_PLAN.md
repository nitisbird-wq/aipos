# Notion Integration Plan — Intake MVP

## Role of Notion

Mission Registry + Digital Brain projection (SSOT for humans).

Not the runtime database for every internal event.

## Separation

| Store | Holds |
|---|---|
| App DB | intakes, missions runtime, audit_events, sync status, policies, capability seed |
| Notion | Mission registry rows/pages (approved fields) |
| Audit | App DB append-only (optional later summary in Notion) |
| External refs | URIs only in both |

## After Mapping Accept

1. Persist Mission in App DB (`status=ready`).
2. Attempt Notion create/update with approved field allow-list.
3. On verified Notion response: store `notion_page_id`, `sync_status=synced`, `synced_at`.
4. On failure: `sync_status=failed`, store error code/message; **UI must not claim success**.
5. Provide retry: `POST /api/missions/{id}/notion/retry`.

## Approved fields to sync (MVP allow-list)

- mission_id, title/summary, desired_outcome, status, planning_status  
- operational_risk, sensitivity_flags, deadline  
- criticality, current_blockers (summary)  
- source_intake_id, mapping_version  
- anticipated_approval_points (text)  
- Notion-safe links to evidence refs (not full sensitive payloads)

## Do not sync

- Full raw sensitive attachments  
- Secrets  
- Complete audit stream (unless summarized later)

## Verification rule

Never claim Notion update succeeded without HTTP success + persisted `notion_page_id` (or equivalent record id).

## Setup

1. Create Notion integration (minimum capabilities: insert/update target DB).  
2. Share Mission database with integration.  
3. Set `NOTION_TOKEN`, `NOTION_MISSIONS_DATABASE_ID` in env.  
4. Document property map in implementation (title, rich_text, select, etc.).

## Failure UX

Dashboard shows sync badge: `synced` | `pending` | `failed` with retry action.
