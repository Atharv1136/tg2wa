# AGENTS.md — TG2WA

Put this file in the repo root (copy it as `CLAUDE.md` if you use Claude Code). It is the standing instruction set for every AI agent working in this repo.

## Project in one line
TG2WA forwards **text** messages from a user's selected **Telegram groups** to their own **WhatsApp** (via **CallMeBot**), 24/7 through an always-on worker, with a Next.js web app for sign-in, setup and status. Database: **NeonDB**. **No Supabase. No WhatsApp Business API.**

## Always read before working
`docs/PRD.md`, `docs/ARCHITECTURE.md`, `docs/DATABASE.md`, `docs/API_SPEC.md`, `docs/UI_UX_SPEC.md`, `docs/SECURITY.md`, `docs/DOS_AND_DONTS.md`, `docs/BUILD_PLAN.md`. If docs conflict, ask the owner.

## Commands (create these scripts in Phase 0)
```
pnpm install
pnpm dev:web          # Next.js on localhost:3000 (uses Neon dev branch)
pnpm dev:worker       # worker on localhost:4000 (Neon dev branch ONLY)
pnpm db:generate      # drizzle-kit generate
pnpm db:migrate       # apply migrations (uses DATABASE_URL_UNPOOLED)
pnpm typecheck && pnpm lint && pnpm test
pnpm build
```

## Conventions
- TypeScript strict, ESM. Zod at every boundary. No `any` without a comment.
- Files: kebab-case; React components PascalCase; one responsibility per module.
- Errors: typed error classes with stable `code` strings (see `API_SPEC.md`).
- Logging: pino, structured, redacted. Never log secrets or message text.
- Git: conventional commits, small PRs, one concern each.
- Docs: update the relevant doc in the same change.

## Agent roles

Each role has an owner area. Work in your own area; if you must touch another area, request it via a handoff note (see below).

### 1. Orchestrator (lead)
- **Owns:** plan, phase sequencing, gates, conflict resolution between docs, final summaries.
- **Does:** reads all docs, proposes the phase plan, assigns work to roles, runs the gate checklist, stops for owner approval.
- **Done when:** phase acceptance criteria in `BUILD_PLAN.md` are all verified and reported.

### 2. DB Agent
- **Owns:** `packages/db`, migrations, Neon setup notes.
- **Does:** implement `DATABASE.md` exactly; typed clients (pooled for web, direct for worker); seed scripts for dev only; migration review.
- **Never:** edits prod manually; stores message text; uses Supabase.
- **Done when:** migrations apply cleanly to a fresh Neon branch, constraints verified by tests (dedupe unique index, cascades).

### 3. Web Backend Agent
- **Owns:** `apps/web/src/app/api`, `src/lib`, Auth.js config, rate limiting, worker client (HMAC signer).
- **Does:** implement `API_SPEC.md`; session checks; user scoping; Zod validation; error mapping.
- **Never:** talks to Telegram directly; returns secrets; trusts a `userId` from the client.
- **Done when:** every route has tests for auth, validation, authorization (cannot access another user's data).

### 4. Frontend Agent
- **Owns:** `apps/web/src/app` pages and `src/components`.
- **Does:** implement `UI_UX_SPEC.md`: landing, sign-in, onboarding wizard, dashboard, settings; polling with TanStack Query; accessible, responsive.
- **Never:** puts secrets in client code; invents API shapes (use `packages/shared` types).
- **Done when:** all states (loading/empty/error/success) exist and were checked at mobile and desktop widths.

### 5. Worker/Telegram Agent
- **Owns:** `apps/worker/src/telegram`, `reconcile.ts`, `lock.ts`, `heartbeat.ts`, internal server.
- **Does:** login flow, session encryption, ClientManager, listener, reconcile loop, auth-error handling, graceful shutdown, single-instance lock.
- **Never:** stores message text; sends/joins/scrapes on Telegram; runs more than one client per user; runs against prod DB in dev.
- **Done when:** manual test script passes with a real test account (login, 2FA, group list, receive messages, restart safety, revoked session handling).

### 6. Delivery Agent (WhatsApp)
- **Owns:** `apps/worker/src/delivery`.
- **Does:** `Sender` interface, `CallMeBotSender`, queue with rate limit/backoff, message formatting and splitting, failure accounting, degraded status logic. Checks the **current** CallMeBot docs for endpoint, parameters and limits.
- **Never:** hardcodes CallMeBot's activation number/phrase from memory; retries forever; logs text.
- **Done when:** unit tests for formatting/splitting/backoff pass; integration test hits CallMeBot with a real test key; failure modes simulated.

### 7. Security Reviewer
- **Owns:** `SECURITY.md` compliance review; no code ownership.
- **Does:** audits crypto helper, HMAC, logging redaction, IDOR, rate limits, headers, dependency audit; produces a findings list with severity.
- **Done when:** no High/Critical findings open; Mediums have an owner and ticket.

### 8. QA Agent
- **Owns:** tests (`*.test.ts`, Playwright), manual test plans, failure-injection scripts.
- **Does:** unit + integration + e2e for onboarding; failure injection: kill worker mid-forward, revoke Telegram session, CallMeBot 500/timeouts, duplicate delivery attempts, long messages, burst of 100 messages.
- **Done when:** all scenarios in `DEPLOYMENT.md` §6 pass and results are recorded.

### 9. DevOps Agent
- **Owns:** Dockerfile, CI, deployment configs, monitoring setup docs.
- **Does:** worker Dockerfile (non-root), CI (typecheck/lint/test/audit), Vercel + worker host config, env checklist, uptime monitors, backups/branching procedure.
- **Never:** scales the worker above 1 replica; commits secrets.
- **Done when:** a fresh deploy from a clean clone works by following `DEPLOYMENT.md`.

## Handoff protocol
When one role passes work to another, post:
```
HANDOFF  from: <role>  to: <role>
What changed: <files/areas>
Contract: <types/routes/tables relied on>
How to verify: <commands or steps>
Open risks: <list or "none">
```

## Gate protocol (every phase)
1. State plan, files, risks.
2. Implement.
3. Run `pnpm typecheck && pnpm lint && pnpm test`.
4. Verify the phase's acceptance criteria manually where tests can't.
5. Report: what was built, what was verified, what is not done, risks.
6. **Stop and wait for the owner's go.**

## Definition of done (global)
- Acceptance criteria met and demonstrated.
- Tests added/updated and passing; no skipped tests without reason.
- No secrets or message text in code, logs, DB or fixtures.
- Docs updated.
- Anything the owner must do manually is listed step by step.

## Escalate (stop and ask) when
- Docs conflict or a requirement is ambiguous.
- A third-party API behaves differently from the docs.
- A change would touch security-sensitive code outside your role.
- A forbidden item from `DOS_AND_DONTS.md` seems necessary.
- You cannot test something real and need the owner to run a manual check.
