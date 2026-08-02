## Mission / Requirement

- **Mission ID:**
- **Requirement ID:**
- **Linked issue:**

## Architecture / ADR

- **Architecture reference:** (e.g. `docs/AIPOS_ARCHITECTURE_CONTRACT.md`)
- **ADR reference:** (e.g. ADR-00x / none)
- **Locked decision impact:** none / listed below (requires new ADR if changing D1–D6 or approved ADR)

## Change Summary

- What changed and why
- Scope (in / out)

## Risk Assessment

| Area | Impact (none / low / medium / high) | Notes |
|---|---|---|
| Business | | |
| Architecture | | |
| Data / schema | | |
| Security / secrets / permissions | | |
| AI / Agent authority | | |
| Database / migrations | | |
| Operations / rollback | | |

## Data and Security Impact

- Secrets introduced: none / env-only (list keys, never values)
- External writes (Notion / n8n / DB): mock only / real (justify)
- PII / sensitive classifications touched: none / listed

## AI / Agent Impact

- ChatGPT remains Mission Commander Assistant only (no confirm/dispatch): yes / n/a
- User remains final authority: yes / n/a
- Gates / transitions / verification unchanged or covered by tests: yes / n/a

## Testing Evidence

- [ ] `npm.cmd run lint`
- [ ] `npm.cmd run format:check`
- [ ] `npm.cmd test`
- [ ] `npm.cmd run build`
- [ ] `npm.cmd run aipos -- doctor --profile pr`
- [ ] E2E / smoke (if UI or intake flow touched)
- [ ] Screenshots (if UI changed)

Doctor result summary:

```text
(paste overall status / exit code)
```

## Rollback Plan

- How to revert this change safely
- Data/migration rollback notes (if any)

## Checklist

- [ ] No secrets, tokens, keys, or real credentials committed
- [ ] No runtime data / `.env` / local databases committed
- [ ] Does not alter Phase 1 locked decisions or approved ADRs without a new ADR
- [ ] Domain contracts / schemas unchanged unless ADR + tests updated
- [ ] Direct `PATCH` mission status still forbidden; transitions remain command-based
- [ ] Three-State honesty preserved for external sync claims
