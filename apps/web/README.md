# AIPOS Web App

Next.js App Router application for **Mission Intake MVP v0.1**.

Repository-root docs and commands are authoritative:

- Setup / env placeholders: [../../README.md](../../README.md), [../../.env.example](../../.env.example)
- Agent rules: [../../AGENTS.md](../../AGENTS.md)
- Architecture contract: [../../docs/AIPOS_ARCHITECTURE_CONTRACT.md](../../docs/AIPOS_ARCHITECTURE_CONTRACT.md)
- GitHub governance / CI: [../../.github/](../../.github/)

## Local commands (from repo root)

```bash
npm.cmd install
npm.cmd run dev
npm.cmd run lint
npm.cmd run format:check
npm.cmd test
npm.cmd run build
npm.cmd run doctor
```

Default local mode uses the DEV file store, `NOTION_ADAPTER=mock`, and `ANALYZE_PROVIDER=none`.
Never commit `.env` / `.env.local` or real credentials.
