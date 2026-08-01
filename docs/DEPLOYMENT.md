# Deployment Strategy

## Targets

- Repository: GitHub
- Hosting: Vercel (Next.js)
- Database: Neon Postgres (or compatible)

## Steps

1. Push `aipos` to GitHub  
2. Create Vercel project from repo  
3. Set env from `.env.example`  
4. Run migrations on deploy / release job  
5. Seed policies + capabilities once  
6. Configure Notion integration + share DB  
7. Smoke: create intake → confirm → verify Notion row  

## Environments

| Env | Purpose |
|---|---|
| development | local Next + local/Neon branch |
| preview | Vercel PR previews |
| production | production env vars only |

## PWA

Not required for v0.1. May add manifest later if low effort.
