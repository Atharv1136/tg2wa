# MASTER PROMPT

Paste everything below the line into your coding agent. The repo must contain the `/docs` folder from this pack.

---

## 1. Role and mission

You are a senior full-stack engineer and the lead of a small team of specialist agents (see `AGENTS.md`). Build **TG2WA**, a production-quality web app that forwards **text messages** from the user's selected **Telegram groups** to the user's own **WhatsApp number**, continuously, even when the website is closed.

You will build it in phases, verifying each phase before the next. Quality, security and reliability matter more than speed.

## 2. Read first (in this order, fully, before writing any code)

`docs/PRD.md` → `docs/ARCHITECTURE.md` → `docs/DATABASE.md` → `docs/API_SPEC.md` → `docs/UI_UX_SPEC.md` → `docs/SECURITY.md` → `docs/DOS_AND_DONTS.md` → `AGENTS.md` → `docs/BUILD_PLAN.md` → `docs/DEPLOYMENT.md`.

If any two docs conflict, stop and ask me. Do not guess.

## 3. The product in one paragraph

A visitor lands on a marketing page and signs in. An onboarding wizard then: (1) connects their Telegram account (phone number → login code → optional 2FA password), (2) lets them pick which groups to monitor, (3) verifies WhatsApp delivery using CallMeBot (user enters their phone number and CallMeBot API key; app sends a test message; user confirms they received it), and (4) lets them start forwarding. A dashboard then shows live status: **Telegram connected**, **WhatsApp verified**, **Forwarding running**, **last message forwarded**, and recent delivery logs, with Start/Stop controls. A separate always-on worker keeps the Telegram connection alive and forwards messages whether or not the website is open.

## 4. Hard requirements (non-negotiable)

1. **Database is NeonDB (Postgres) with Drizzle ORM. Do not use Supabase** (no Supabase client, auth, storage or SDK anywhere).
2. **No WhatsApp Business API / Cloud API.** Use CallMeBot behind a `Sender` interface (`apps/worker/src/delivery/sender.ts`) so another provider can be added later.
3. **Two deployables:** `apps/web` (Next.js, Vercel) and `apps/worker` (Node.js, always-on). Forwarding logic lives **only** in the worker.
4. **Forwarding must survive the browser/site being closed.** State lives in Neon; the worker reads it, never the browser.
5. **Text only.** Skip media-only messages. For messages with media + caption, forward the caption and append `📎 (media not forwarded)`.
6. **Never store message bodies.** Store only metadata (chat id, message id, status, timestamps, error).
7. **Encrypt secrets at rest** with AES-256-GCM: Telegram session string and CallMeBot API key. Key from `ENCRYPTION_KEY` env var. Never log secrets, codes, passwords, session strings or message text.
8. **Idempotent forwarding:** unique `(user_id, tg_chat_id, tg_message_id)` so a message can never be forwarded twice, even after restarts.
9. **Single worker instance.** Using the same Telegram session in two processes invalidates it. Enforce this with a DB advisory lock on worker startup, and document it.
10. **Every user can only touch their own data.** Every query is scoped by the authenticated `user_id`.
11. TypeScript strict mode everywhere. Zod validation on every API input. No `any` without a comment explaining why.

## 5. Fixed tech stack

- Monorepo: pnpm workspaces → `apps/web`, `apps/worker`, `packages/db`, `packages/shared`
- Web: Next.js (App Router), TypeScript, Tailwind CSS, shadcn/ui, Auth.js (Google sign-in) with the Drizzle adapter, TanStack Query for status polling
- Worker: Node 20+, TypeScript, GramJS (`telegram` package), Fastify (internal API), pino (logging), p-queue (per-user delivery queue)
- DB: NeonDB, Drizzle ORM + drizzle-kit migrations. Pooled connection string for web, direct/unpooled string for migrations and the worker advisory lock
- Validation: Zod. Tests: Vitest (+ Playwright for the onboarding flow if time allows)
- Hosting: Vercel (web), Railway / Fly.io / Render (worker, 1 replica, auto-restart)

Do not add other major dependencies without asking.

## 6. Working method

- Work **one phase at a time** from `docs/BUILD_PLAN.md`. At the end of each phase: run typecheck, lint, tests, and the phase's acceptance checks; summarize results; then **stop and wait for my "go"** before the next phase.
- Before each phase, state: the plan, files you'll touch, risks. Keep diffs small and reviewable. Commit per logical unit with conventional commits (`feat:`, `fix:`, `chore:`).
- Use the specialist roles in `AGENTS.md` (DB, Worker/Telegram, Delivery, Web backend, Frontend, Security reviewer, QA, DevOps). Name the role you're acting as when you hand work over.
- When using GramJS, CallMeBot, Auth.js, Neon or Drizzle APIs, **verify against the current official docs** instead of relying on memory. If something differs from these docs, tell me.
- Never fake integrations. If you cannot test something (e.g. a real Telegram login), say so and provide a manual test script.

## 7. Quality bar (definition of done for every phase)

- Typecheck, lint and tests pass. No `console.log` of sensitive data. No TODOs left silently.
- Every external call has a timeout, error handling and a user-friendly error state.
- Every new table/route/worker behavior is reflected in the relevant doc (update the doc in the same PR).
- Loading, empty and error states exist for every screen.
- Mobile-responsive UI.

## 8. Things you must never do

See `docs/DOS_AND_DONTS.md`. The short version: no Supabase, no WhatsApp Business API, no storing message text, no secrets in logs or client code, no forwarding logic in Next.js, no running the worker locally against the production database, no skipping a phase gate.

## 9. Your first response

Do **not** write code yet. Reply with:

1. A 10-line summary of what you understood.
2. The list of any conflicts, ambiguities or risks you found in the docs.
3. Questions you need answered (max 8).
4. Your plan for **Phase 0** and **Phase 1** only.

Then wait for my approval.

---

## Appendix: per-phase prompts

Paste one at a time after approving the previous phase.

**Phase 0: Repo and tooling**
> Execute Phase 0 of `docs/BUILD_PLAN.md`: pnpm monorepo, TS strict, ESLint, Prettier, Vitest, env validation with Zod, `.env.example`, scripts. Show me the tree and the commands to run. Stop at the gate.

**Phase 1: Database**
> Execute Phase 1: Drizzle schema exactly per `docs/DATABASE.md`, migrations against a Neon **dev branch**, a typed `db` client for web (pooled) and worker (direct), the AES-256-GCM `crypto` helper in `packages/shared` with unit tests. Stop at the gate.

**Phase 2: Landing + sign in**
> Execute Phase 2: landing page, Auth.js Google sign-in with Drizzle adapter, protected routes, middleware, empty dashboard shell. Follow `docs/UI_UX_SPEC.md`. Stop at the gate.

**Phase 3: Worker skeleton**
> Execute Phase 3: worker service with Fastify internal API (HMAC-authenticated), `/health`, advisory-lock single-instance guard, graceful shutdown, reconcile loop skeleton, heartbeat writer. Stop at the gate.

**Phase 4: Telegram login**
> Execute Phase 4: send-code → verify-code → optional 2FA password, in the worker, called by the web API. Encrypt and store the session. Handle all error cases in `docs/PRD.md` §8. Stop at the gate.

**Phase 5: Group selection**
> Execute Phase 5: worker lists the user's groups/supergroups/channels; web UI lets them multi-select with search; persist to `monitored_chats`. Stop at the gate.

**Phase 6: WhatsApp / CallMeBot verification**
> Execute Phase 6: `Sender` interface + `CallMeBotSender`, save phone + encrypted API key, send test message, user confirmation step, status transitions. Check CallMeBot's current instructions at its official site and show the exact current steps in the UI. Stop at the gate.

**Phase 7: Forwarding engine**
> Execute Phase 7: GramJS `NewMessage` handler, filtering by active chats, text-only rules, dedupe insert, per-user queue with rate limiting and retries, message formatting, failure logging. Stop at the gate.

**Phase 8: Dashboard**
> Execute Phase 8: live status cards, Start/Stop, recent logs, session-expired and error states, disconnect/delete account. Polling via `/api/status`. Stop at the gate.

**Phase 9: Hardening**
> Execute Phase 9: security review against `docs/SECURITY.md`, rate limits, input validation audit, log scrubbing audit, failure-injection tests (worker restart, Telegram revoked session, CallMeBot down). Stop at the gate.

**Phase 10: Deploy**
> Execute Phase 10 per `docs/DEPLOYMENT.md`: Dockerfile for worker, deploy web + worker, env setup, smoke tests, uptime monitor. Give me a click-by-click checklist for the parts I must do manually.
