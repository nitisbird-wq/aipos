# UI Flow — Low-Fidelity Page Map

## Routes

```text
/                    → redirect /missions or /intake
/intake              → 4.1 Mission Intake form
/intake/[id]         → 4.2 Mission Understanding
/missions            → 4.3 Mission Dashboard
/missions/[id]       → 4.4 Mission Detail
/governance          → 4.5 Policy Viewer (read-only)
```

## 4.1 Mission Intake

Fields: mission request, attachment refs, deadline, optional constraints  
Action: Submit for analysis → `POST /intakes` + `analyze`

## 4.2 Mission Understanding

Display: summary, outcome, success criteria, assumptions, blockers, draft work map, capability families, risk, sensitivity, destinations, handling, anticipated approvals  

Actions: Correct · Add missing info · Confirm mission · Cancel intake

## 4.3 Mission Dashboard

Columns: Mission ID, title, status, planning_status, risk, sensitivity, deadline, blockers, last update, Notion sync status

## 4.4 Mission Detail

Sections: original request ref, confirmed understanding, draft work map, governance controls, transition history, audit log, knowledge/external refs, Notion sync panel + retry

## 4.5 Governance

Table: policy_id, version, description, severity, enforcement action, enabled

## Responsive

- Mobile: single column, sticky primary actions  
- iPad: two-column understanding where space allows  
- Desktop: dashboard table + detail side panels optional  

## Claim honesty UI

Labels must not say “Saved to Notion” unless `sync_status=synced` with page id.
