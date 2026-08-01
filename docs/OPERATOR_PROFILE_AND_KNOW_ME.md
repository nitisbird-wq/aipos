# Operator Profile and Know-Me

**Binding decision:** [AIPOS_PHASE_1_DECISIONS.md](./AIPOS_PHASE_1_DECISIONS.md) D3  
**Notion SSOT:** Identity OS, Role OS, Command Center v2, Current Priorities

## Purpose

Runtime profile so AIPOS does not treat พ.ต.ท.นิธิศ as a generic user. Profile is cached in App DB; Notion remains human SSOT for identity/role edits.

## Profile fields (target schema)

| Group | Contents |
|---|---|
| Identity | Name, rank/role summary, unit, education (ผกก.158), device prefs (iPad primary) |
| Roles | Ten Role OS roles + `active_role` per mission |
| Working style | Think first; actionable outputs; tables/steps/closeout; drive after confirm |
| Communication | Thai-first; professional; EN terms when precision helps; no empty praise |
| Deliverable prefs | One Page, Word, Excel, PDF, Infographic; TH Sarabun 14–16 when relevant |
| Hard constraints | No invented facts; Need-to-Know; Three-State honesty; no silent external claims |
| Domain context | AIPOS, intelligence/Happy Water, ตร.419, SAHAKON, Family AI (limited) |
| Current priorities | Synced summary from Current Priorities page |
| Learned prefs | From artifact accept/reject |

## Inject points

1. Chat intake: detect role → load profile → ask only blocking gaps  
2. Analyze / planning briefs  
3. Matching (prefer tool chain from Command Center)  
4. Execution prompts (Handling Gate–approved slice only)  
5. Closeout + feedback into `learned_prefs`

## Sync rules

- Verified Notion read before treating profile as fresh  
- Store `profile_version` / content hash; cache with TTL  
- Main identity/role edits happen in Notion; app may edit learned prefs only  
- Family and case data: minimum necessary; never fabricate

## Access note (2026-08-01)

- Readable Command Center id: `38ebc165-be4c-811c-b05b-d05e2c2791b8`  
- Share URL id `bf4785fe…` returned 404 to MCP — treat as same draft family when content matches
