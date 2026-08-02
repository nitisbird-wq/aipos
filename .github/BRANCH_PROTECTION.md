# Branch protection checklist (manual GitHub Settings)

CI workflows **cannot** enable branch protection by themselves.
After the repository has a GitHub remote and `main` exists, apply these settings in:

**Settings → Rules → Rulesets** (preferred) or **Settings → Branches → Branch protection rules**

## Protect `main`

- [ ] Protect branch `main` (and `master` only if still present during rename)
- [ ] Require a pull request before merging
- [ ] Require approvals (recommended: ≥ 1)
- [ ] Require review from Code Owners for owned paths
- [ ] Require conversation resolution before merge
- [ ] Require status checks to pass before merging
- [ ] Require branches to be up to date before merging (recommended)
- [ ] Restrict who can push to matching branches (no direct push for most roles)
- [ ] Do not allow force pushes
- [ ] Do not allow deletions
- [ ] Require linear history (optional but recommended for this repo)

## Required status checks (names from `.github/workflows/ci.yml`)

- [ ] `Secret scan`
- [ ] `Verify`

## CODEOWNERS

- [ ] Confirm `.github/CODEOWNERS` handles match the real GitHub account(s)
- [ ] Enable “Require review from Code Owners”

## Notes for AIPOS

- Doctor PR profile soft-fails items that cannot be verified from CI (e.g. Branch protection NA locally).
- Do not claim branch protection is active until this checklist is completed on the remote.
- Production deploy workflows are **out of scope** for the governance baseline.

## Release tagging convention (manual)

- Tags: `vMAJOR.MINOR.PATCH` (e.g. `v0.1.0`)
- Prefer annotated tags after PR merge to `main`
- No automatic production publish from this baseline
