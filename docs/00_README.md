# TG2WA — Telegram → WhatsApp Forwarder: Docs Pack

Working name: **TG2WA** (rename freely).

A web app where a user signs in, connects their Telegram account, picks groups, verifies their own WhatsApp number via CallMeBot, and gets every **text** message from those groups forwarded to their WhatsApp, **24/7, even when the website is closed**.

## How to use this pack

1. Create a new repo. Put all these files in `/docs` (put `AGENTS.md` in the repo root too; copy it as `CLAUDE.md` if you use Claude Code).
2. Open your coding agent (Claude Code, Cursor, etc.) in the repo.
3. Paste the contents of `MASTER_PROMPT.md` (everything under the line). The agent will read the other docs itself.
4. Work phase by phase using `BUILD_PLAN.md`. Do not skip the gates.

## File index (read in this order)

| # | File | Purpose |
|---|------|---------|
| 1 | `MASTER_PROMPT.md` | The prompt you paste into the agent, plus per-phase prompts |
| 2 | `PRD.md` | What we are building and why: scope, requirements, flows, edge cases |
| 3 | `ARCHITECTURE.md` | System design, components, sequences, repo layout, env vars |
| 4 | `DATABASE.md` | NeonDB schema (Drizzle), indexes, migration rules |
| 5 | `API_SPEC.md` | Web API routes + internal worker API |
| 6 | `UI_UX_SPEC.md` | Pages, wizard, dashboard, status model, copy |
| 7 | `SECURITY.md` | Threat model, encryption, secrets, privacy |
| 8 | `DOS_AND_DONTS.md` | Hard rules for humans and agents |
| 9 | `AGENTS.md` | Agent roles, ownership, handoff rules, definition of done |
| 10 | `BUILD_PLAN.md` | Step-by-step phases with acceptance gates |
| 11 | `DEPLOYMENT.md` | Neon, Vercel, worker hosting, env, smoke tests, monitoring |

## Key decisions (already made)

- **Database:** NeonDB (Postgres) with Drizzle ORM. **No Supabase.**
- **Web app:** Next.js (App Router) + TypeScript + Tailwind + shadcn/ui, hosted on Vercel.
- **Always-on worker:** separate Node.js service (GramJS) on Railway / Fly.io / Render / a VPS. Vercel cannot hold a persistent Telegram connection, so the worker is mandatory.
- **WhatsApp delivery:** CallMeBot (free, no Business API). Behind a `Sender` interface so it can be swapped later.
- **Messages:** text only, to the user's own number only. Message bodies are **never stored**.

## Known risks (read before building)

- CallMeBot is a free third-party service: no SLA, rate limited, and message text passes through it.
- Reading Telegram as a user account (not a bot) is unofficial-adjacent: use it only for the user's own account, low volume, no spam.
- A Telegram session string = full account access. Encrypt it, never log it, never run two workers with the same session.
