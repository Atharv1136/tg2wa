# ARCHITECTURE — TG2WA

## 1. Why two services

Vercel (and any serverless host) runs short-lived functions. Telegram's MTProto connection must stay open permanently to receive messages. So:

- **`apps/web`** (Next.js on Vercel): UI, sign-in, API routes, reads/writes Neon. Never touches Telegram directly.
- **`apps/worker`** (Node on an always-on host): holds one GramJS connection per user, listens for messages, forwards via CallMeBot, handles Telegram login steps.
- **NeonDB**: the shared source of truth. The browser is never required for forwarding.

```
 Browser ──HTTPS──► Next.js (Vercel) ──SQL──► NeonDB ◄──SQL── Worker (Railway/Fly/Render)
                         │                                      │  ▲
                         │  HMAC-signed HTTPS (internal API)    │  │ MTProto (GramJS)
                         └──────────────────────────────────────┘  ▼
                                                              Telegram
                                                                  │ new messages
                                                                  ▼
                                                        per-user queue ──HTTPS──► CallMeBot ──► WhatsApp
```

## 2. Components

### 2.1 Web app (`apps/web`)
- Pages: `/` (landing), `/sign-in`, `/onboarding`, `/dashboard`, `/settings`.
- Auth.js (Google) with Drizzle adapter, database sessions.
- Route handlers under `/api/*` validate with Zod, check session, then either read/write Neon or call the worker's internal API.
- Dashboard polls `/api/status` every 5 s (TanStack Query).

### 2.2 Worker (`apps/worker`)
Modules:
- `server/` Fastify internal API (HMAC-authenticated).
- `telegram/login.ts` pending-login manager (in-memory map `userId → {client, phoneCodeHash, expiresAt}`, TTL 10 min).
- `telegram/manager.ts` **ClientManager**: map `userId → running GramJS client`. Start, stop, restart, health.
- `telegram/listener.ts` attaches `NewMessage` handler, filters, enqueues.
- `delivery/sender.ts` interface `Sender { send(dest, text): Promise<SendResult> }`.
- `delivery/callmebot.ts` implementation.
- `delivery/queue.ts` per-user `p-queue` (concurrency 1, interval 2 s), retry/backoff.
- `reconcile.ts` every 60 s (and on demand): compare DB desired state vs running clients; start/stop/refresh.
- `heartbeat.ts` writes `worker_heartbeats` every 30 s.
- `lock.ts` Postgres advisory lock for single instance.

### 2.3 Shared packages
- `packages/db`: Drizzle schema, migrations, typed clients.
- `packages/shared`: Zod schemas, status enums, `crypto.ts` (AES-256-GCM), HMAC helper, constants.

## 3. Key flows

### 3.1 Telegram login (split across stateless web and stateful worker)
1. Browser → `POST /api/telegram/send-code {phone}`.
2. Web (authed) → worker `POST /internal/telegram/send-code {userId, phone}` (HMAC).
3. Worker creates a GramJS client with an empty `StringSession`, calls `sendCode`, keeps `{client, phoneCodeHash}` in memory (TTL 10 min). DB status → `code_sent`.
4. Browser → `POST /api/telegram/verify-code {code}` → worker signs in.
   - Success → export session string → **encrypt** → save → status `connected` → destroy pending login (client is then handed to ClientManager if forwarding is on).
   - 2FA required → status `password_required`; browser → `/verify-password`.
5. Phone number is never stored in full; only masked last 4.

> If the worker restarts mid-login the pending state is lost. The UI shows "Login expired, start again". That is acceptable.

### 3.2 Group selection
1. Browser → `GET /api/telegram/groups` → worker `GET /internal/telegram/:userId/dialogs` (uses the stored session via a short-lived or the running client; `getDialogs`, filter groups/supergroups/channels).
2. Browser → `PUT /api/telegram/groups {chats:[{id,title,type}]}` → web writes `monitored_chats` → pings worker `POST /internal/users/:id/refresh`.

### 3.3 WhatsApp verification
1. Browser → `POST /api/whatsapp/save {phone, apiKey}` → web encrypts key, stores, status `unverified`.
2. Browser → `POST /api/whatsapp/test` → web calls worker `/internal/whatsapp/test` (CallMeBot calls live in the worker so there is one delivery code path).
3. User confirms receipt → `POST /api/whatsapp/confirm` → `verified`.

### 3.4 Forwarding (the hot path, worker only)
1. Telegram pushes an update → `NewMessage` event on that user's client.
2. Listener checks: forwarding enabled? chat in active set (in-memory `Set` refreshed on reconcile)? not outgoing? has text?
3. Insert into `forwarded_messages` with `ON CONFLICT DO NOTHING`. If 0 rows inserted → duplicate → stop.
4. Enqueue send job in that user's queue. Format message, split if > 1,500 chars.
5. `CallMeBotSender.send()` with 10 s timeout. Success → mark `sent`. Failure → retry (5 s, 20 s, 60 s) → `failed`.
6. On 5 consecutive failures → WhatsApp status `degraded`.

### 3.5 Status
- Web `/api/status` reads: telegram_connections, whatsapp_destinations, forwarding_settings, worker_heartbeats, counters from `forwarded_messages` (today).
- Worker is `online` if the user's heartbeat `< 90 s` old.

### 3.6 Start / Stop
- Web writes `forwarding_settings.enabled`, then pings worker refresh. The worker reconciler also picks it up within 60 s if the ping fails.

## 4. Reconcile loop (desired vs actual)

```
every 60s or on refresh(userId):
  desired = users where enabled && telegram=connected && whatsapp=verified && ≥1 active chat
  for u in desired not running      → start client
  for u in running not desired      → stop client
  for u in running                  → reload active chat set
```
Start client = decrypt session → connect → verify authorization → attach listener → heartbeat. If auth fails (`AUTH_KEY_UNREGISTERED`, `SESSION_REVOKED`, `USER_DEACTIVATED`) → status `session_expired`, forwarding blocked.

## 5. Single-instance guarantee
- On boot: `SELECT pg_try_advisory_lock(<constant>)` on a **direct (unpooled)** Neon connection held open for the process lifetime. If false → log and exit non-zero.
- Hosting config: **replicas = 1**, no autoscaling, no rolling overlap (stop old before starting new, or rely on the lock to make the new one wait/retry for up to 60 s).
- **Never run a dev worker against the production DB.** Use a Neon dev branch.

## 6. Repo layout

```
tg2wa/
├─ AGENTS.md  (copy as CLAUDE.md if desired)
├─ docs/
├─ apps/
│  ├─ web/
│  │  ├─ src/app/(marketing)/page.tsx
│  │  ├─ src/app/(auth)/sign-in/page.tsx
│  │  ├─ src/app/(app)/onboarding/…
│  │  ├─ src/app/(app)/dashboard/…
│  │  ├─ src/app/api/**/route.ts
│  │  ├─ src/lib/{auth,worker-client,env}.ts
│  │  └─ src/components/**
│  └─ worker/
│     ├─ src/{index,env,lock,reconcile,heartbeat}.ts
│     ├─ src/server/**
│     ├─ src/telegram/{login,manager,listener}.ts
│     └─ src/delivery/{sender,callmebot,queue,format}.ts
├─ packages/
│  ├─ db/{schema.ts,client.ts,migrations/}
│  └─ shared/{crypto.ts,hmac.ts,schemas.ts,status.ts}
├─ pnpm-workspace.yaml
└─ package.json
```

## 7. Environment variables

| Var | Used by | Notes |
|-----|---------|-------|
| `DATABASE_URL` | web | Neon **pooled** string |
| `DATABASE_URL_UNPOOLED` | worker, migrations | Neon direct string (advisory lock needs it) |
| `AUTH_SECRET` | web | `openssl rand -base64 32` |
| `AUTH_GOOGLE_ID` / `AUTH_GOOGLE_SECRET` | web | Google Cloud OAuth |
| `AUTH_URL` | web | Public site URL |
| `TELEGRAM_API_ID` / `TELEGRAM_API_HASH` | worker | from my.telegram.org |
| `ENCRYPTION_KEY` | web + worker | 32 bytes base64. **Same value in both.** Never rotate without a migration plan |
| `INTERNAL_API_SECRET` | web + worker | HMAC signing key |
| `WORKER_URL` | web | Worker public HTTPS URL |
| `PORT` | worker | Host-provided |
| `LOG_LEVEL` | both | `info` default |

All env vars are parsed by Zod at boot; the process exits with a clear message if any are missing.

## 8. Internal API authentication

Web → worker requests include headers `x-timestamp` and `x-signature = HMAC_SHA256(INTERNAL_API_SECRET, timestamp + "." + method + "." + path + "." + sha256(body))`. Worker rejects if timestamp skew > 60 s or signature invalid (constant-time compare). `/health` is unauthenticated and returns only `{ok:true}`.

## 9. Failure modes

| Failure | Detection | Behavior |
|---------|-----------|----------|
| Worker crash | Host restart; heartbeat gap | Auto-restart; dashboard shows `offline` meanwhile |
| Neon unreachable | DB errors | Worker keeps clients connected and retries DB writes with backoff. Incoming messages wait in a bounded in-memory buffer (max 200 per user) until the dedupe insert succeeds; overflow is dropped and logged (metadata only) |
| Telegram session revoked | auth error on connect/update | `session_expired` |
| CallMeBot down | non-2xx/timeouts | retry → `failed` → `degraded` |
| Telegram FloodWait | RPC error w/ seconds | pause that user's client operations for the wait |

## 10. Observability
- pino JSON logs with `userId` (internal id only), `chatId`, `messageId`, `status`, `latencyMs`. A redaction list removes `session`, `apiKey`, `password`, `code`, `text`.
- Uptime monitor pings worker `/health` and web `/`.
- Optional: Sentry on both apps with scrubbing configured.
