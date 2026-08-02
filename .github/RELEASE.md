# Release governance (baseline)

## Version tags

- Format: `vMAJOR.MINOR.PATCH` (example: `v0.1.0`)
- Create tags from `main` after CI is green
- Prefer annotated tags: `git tag -a v0.1.0 -m "AIPOS Mission Intake MVP v0.1.0"`

## Before tagging

1. PR merged with Mission / ADR references completed
2. CI `Secret scan` + `Verify` green on `main`
3. `npm run aipos -- doctor --profile pr` green on clean checkout
4. No production secrets in the repository
5. Rollback notes recorded in the release PR or changelog entry

## Out of scope for this baseline

- Automatic production deploy
- Publishing packages to npm
- Rotating production Notion / Neon credentials
