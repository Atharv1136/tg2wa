# BUILD PLAN — step by step

Rule: one phase at a time. Each phase ends at a **gate**. Do not continue until the owner says go.

Legend: 🧑 = manual step by the owner.

---

## Phase 0: Repo and tooling
**Goal:** a clean, typed monorepo.
**Tasks**
1. pnpm workspace: `apps/web`, `apps/worker`, `packages/db`, `packages/shared`.
2. TypeScript strict base config; ESLint, Prettier, Vitest.
3. Zod env loaders for web and worker (fail fast with clear messages).
4. Root scripts (see `AGENTS.md`), `.env.example` for each app, `.gitignore`.
5. CI workflow: install, typecheck, lint, test, `pnpm audit`.
6. 🧑 Create GitHub repo; add `/docs` and `AGENTS.md`.

**Acceptance:** `pnpm typecheck && pnpm lint && pnpm test` pass on a fresh clone; missing env vars produce a readable error.
**Gate 0.**

## Phase 1: Database and crypto
**Goal:** schema + encryption helper, verified.
**Tasks**
1. 🧑 Create a Neon project; create branches `main` (prod) and `dev`. Copy pooled and direct URLs for `dev`.
2. Implement Auth.js tables + schema from `DATABASE.md`; generate and apply migration to `dev`.
3. Typed clients: web (Neon serverless driver, pooled) and worker (direct).
4. `packages/shared/crypto.ts` AES-256-GCM with `v1:` prefix; HMAC signer/verifier; status enums.
5. Tests: crypto round-trip/tamper/wrong key; HMAC skew/tamper; unique index rejects duplicate `(user_id, chat, msg)`; cascade delete.

**Acceptance:** migration applies to a fresh branch; all tests pass; no message-body column exists.
**Gate 1.**

## Phase 2: Landing page and sign-in
**Goal:** public site + Google sign-in + protected shell.
**Tasks**
1. 🧑 Google Cloud OAuth client (redirect URIs for localhost and production). Put ID/secret in env.
2. Auth.js (Google) + Drizzle adapter, database sessions; middleware protecting `/onboarding`, `/dashboard`, `/settings`.
3. Landing page per `UI_UX_SPEC.md` §2, sign-in page, app shell with sign-out.
4. Post-login redirect logic (onboarding vs dashboard) reading setup state from DB.

**Acceptance:** sign in/out works; unauthenticated access to protected routes redirects; layout verified at 375 px and 1280 px; Lighthouse accessibility ≥ 90.
**Gate 2.**

## Phase 3: Worker skeleton
**Goal:** always-on service that is safe and observable, no Telegram yet.
**Tasks**
1. Fastify server, `/health`, HMAC middleware for `/internal/*`.
2. Advisory-lock single-instance guard on the direct connection; exit if lock not acquired.
3. Heartbeat writer, reconcile loop (no-op clients for now), graceful shutdown.
4. Web-side `worker-client` that signs requests; `/internal/users/:id/refresh` wired.
5. Dockerfile (non-root).

**Acceptance:** second worker instance exits with a clear message; bad/missing signature → 401; stale timestamp → 401; SIGTERM shuts down cleanly and releases lock.
**Gate 3.**

## Phase 4: Telegram login
**Goal:** user can connect Telegram reliably.
**Tasks**
1. 🧑 Get `api_id` / `api_hash` at my.telegram.org; set in worker env.
2. Worker pending-login manager (10 min TTL), `send-code`, `verify-code`, `verify-password` with GramJS (check current docs).
3. Encrypt and store session; store masked phone; store Telegram display name/username; never store code/password.
4. Web routes + onboarding Step 1 UI with all errors from `PRD.md` §8 (wrong/expired code, 2FA, FloodWait, login expired).
5. Disconnect: `auth.LogOut`, wipe session, stop client.
6. Rate limits on all three endpoints.

**Acceptance:** with a real test account: login without 2FA, login with 2FA, wrong code, expired code, disconnect (verify the session disappears from Telegram's active sessions list). DB contains ciphertext only. Logs contain none of code/password/session.
**Gate 4.**

## Phase 5: Group selection
**Goal:** choose what to forward.
**Tasks**
1. Worker `getDialogs` filtered to groups/supergroups/channels (returns id as string, title, type).
2. Web `GET/PUT /api/telegram/groups`; persist to `monitored_chats`; call worker refresh.
3. Onboarding Step 2 UI: search, select all/clear, counter, loading/empty/error.
4. Handle chats the user left (mark inactive on next sync).

**Acceptance:** selection persists across refresh and devices; ids stored as strings; large lists (200+) stay responsive.
**Gate 5.**

## Phase 6: WhatsApp via CallMeBot
**Goal:** verified delivery path.
**Tasks**
1. 🧑 Activate CallMeBot for your own number following their current official instructions; keep the API key.
2. `Sender` interface + `CallMeBotSender` (10 s timeout, URL-encoded params, parse response, map to typed errors). Confirm endpoint/params/limits from the official page.
3. Web `save`, `test`, `confirm` routes; worker `/internal/whatsapp/test`.
4. Onboarding Step 3 UI with live instructions, status transitions, troubleshooting panel.

**Acceptance:** test message arrives on your WhatsApp; wrong key shows friendly error; changing number/key resets to `unverified`; API key is ciphertext in DB.
**Gate 6.**

## Phase 7: Forwarding engine
**Goal:** the core feature.
**Tasks**
1. ClientManager starts/stops clients from reconcile; loads/decrypts sessions; auth-error handling → `session_expired`.
2. `NewMessage` listener: active-chat filter (in-memory set), outgoing filter, text rules, service-message skip.
3. Dedupe insert (`ON CONFLICT DO NOTHING`), per-user queue (concurrency 1, ~2 s spacing, cap 200).
4. Formatter + splitter (≤1,500 chars, `(1/n)` labels, `📎` rule).
5. Retry/backoff (5 s, 20 s, 60 s), `failed` marking, consecutive-failure → `degraded`.
6. Start/Stop endpoints with precondition checks; daily retention job.
7. Onboarding Step 4 UI.

**Acceptance (manual with real accounts):** message in a selected group → appears on WhatsApp in < 10 s; message in an unselected group → nothing; media-only → skipped; caption → forwarded with 📎 note; restart worker → no duplicates; stop → no forwards; start → resumes; burst of 50 messages → all delivered in order or visibly queued, none duplicated.
**Gate 7.**

## Phase 8: Dashboard and settings
**Goal:** the user always knows what's happening.
**Tasks**
1. `GET /api/status` and `/api/logs` per `API_SPEC.md`; status derivation helper in `packages/shared` with unit tests.
2. Dashboard cards, stats, activity table, master toggle, banners (expired, degraded, worker offline).
3. Settings page: edit groups, WhatsApp, disconnect, delete account.
4. Polling every 5 s when visible.

**Acceptance:** closing the browser and reopening shows forwarding kept running and logs from the meantime; killing the worker flips Worker → Offline within 90 s; revoking the session from the Telegram app flips Telegram → Reconnect needed; delete account removes all rows and logs out Telegram.
**Gate 8.**

## Phase 9: Hardening and QA
**Goal:** safe and robust.
**Tasks**
1. Security review against `SECURITY.md`; fix findings.
2. Log-scrub test (grep logs for secrets/text patterns), headers/CSP, rate limits verified.
3. Failure injection: worker kill during queue, Neon outage, CallMeBot 500/timeout, FloodWait, revoked session, two workers.
4. Load check: 50 users × 10 groups simulated with mock listeners where possible.
5. README with setup instructions and known limitations (no catch-up of missed messages in v1).

**Acceptance:** zero open High/Critical findings; all failure-injection scenarios behave as in `PRD.md` §8.
**Gate 9.**

## Phase 10: Deploy
**Goal:** live and monitored.
Follow `DEPLOYMENT.md` end to end: Neon prod branch + migrations, Vercel web, worker host (1 replica), env vars, smoke tests, uptime monitors.

**Acceptance:** all smoke tests in `DEPLOYMENT.md` §6 pass in production; you close your laptop, post in a group from another device, and the message reaches WhatsApp.
**Gate 10 = launch.**

---

## After launch (v1.1 backlog)
- Catch-up of messages missed during downtime (store last seen message id per chat).
- Keyword include/exclude filters, quiet hours, daily digest.
- Second Sender implementation (e.g. whatsapp-web.js) selectable per user.
- Sentry with scrubbing; admin view of worker health.
