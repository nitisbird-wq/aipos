# Security and Permissions — Intake MVP

## Secrets

- Never commit API keys.
- Use environment variables (see `.env.example`).
- Separate development and production credentials.
- Notion token: minimum required access only.

## Logging

- Do not log secrets or full sensitive payloads.
- Redact: raw_request excerpts beyond length limit, attachment contents, tokens.
- Audit stores reason + ids; detail blobs by reference when sensitive.

## Input / auth

- Validate all inputs with Zod (server-side).
- Enforce server-side authorization on mutating routes.
- MVP auth: single-tenant operator session (Auth.js or equivalent).

## External claims

- Distinguish session-only vs external system updates in API/UI copy.
- Notion writes require verified SDK/HTTP response before success messaging.

## Data handling

- Sensitivity flags trigger Handling Gate.
- Destinations must be explicit (`intake_channel`, `notion`, …).
- Prefer references over embedding large files.
