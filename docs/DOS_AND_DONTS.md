# DO'S AND DON'TS

Hard rules for every human and every agent working on TG2WA. If a task seems to require breaking one, stop and ask.

## DO

### Architecture
- DO keep all forwarding logic in `apps/worker`. The web app only reads/writes DB and calls the worker.
- DO treat the DB as the source of truth for desired state (enabled, chats, status).
- DO make the worker idempotent: restart-safe, duplicate-safe.
- DO put WhatsApp delivery behind the `Sender` interface.
- DO use **NeonDB** with Drizzle migrations, pooled URL for web, direct URL for worker lock and migrations.
- DO enforce a single worker instance via advisory lock and `replicas = 1`.

### Security and privacy
- DO encrypt Telegram sessions and CallMeBot keys with AES-256-GCM before they touch the DB.
- DO redact `session`, `apiKey`, `password`, `code`, `text`, `phone` in logs.
- DO scope every query by the authenticated user id.
- DO validate every input with Zod and every env var at boot.
- DO sign web→worker calls with HMAC and a timestamp.
- DO log out the Telegram session server-side when the user disconnects or deletes their account.

### Quality
- DO work phase by phase and stop at each gate.
- DO write tests for crypto, HMAC, dedupe, message formatting/splitting, status derivation, preconditions.
- DO add loading, empty, error states to every screen.
- DO verify third-party API usage (GramJS, CallMeBot, Auth.js, Neon, Drizzle) against current official docs.
- DO update the docs in the same change as the code.
- DO use conventional commits and small PRs.
- DO write user-facing errors in plain language with a next step.

### Operations
- DO use a Neon **dev branch** for local work and a separate Telegram/WhatsApp test account if possible.
- DO monitor `/health` and heartbeat age.
- DO document every manual step the owner must do (Google OAuth, my.telegram.org, hosting).

## DON'T

### Forbidden technology and shortcuts
- DON'T use Supabase in any form (client, auth, storage, realtime, hosting).
- DON'T use the WhatsApp Business / Cloud API.
- DON'T run Telegram clients inside Next.js/Vercel functions.
- DON'T use a Telegram bot token as the reader; we read as the user's account.
- DON'T add major dependencies, frameworks or services without approval.
- DON'T use `localStorage` or cookies you control to hold secrets or auth state beyond Auth.js.

### Data and secrets
- DON'T store message text, media or chat history anywhere (DB, logs, error trackers, analytics).
- DON'T store the full Telegram phone number or the login code/2FA password.
- DON'T commit secrets, `.env` files or session strings. Provide `.env.example` only.
- DON'T put secrets in `NEXT_PUBLIC_*` vars or client components.
- DON'T return secrets, encrypted blobs or session strings from any API.

### Operations
- DON'T run two worker instances, or a local dev worker, against the production DB or with a production session. It invalidates the session.
- DON'T poll the DB faster than every 60 s (reconcile) / 30 s (heartbeat); Neon compute cost matters.
- DON'T retry CallMeBot sends indefinitely; max 3 retries then `failed`.
- DON'T forward the same message twice; never bypass the unique constraint.
- DON'T auto-send, auto-join or scrape on Telegram. Listen only.
- DON'T allow custom destination numbers in v1 (own number only).

### Process
- DON'T skip a phase gate or build several phases at once.
- DON'T mark work done if typecheck, lint, tests or acceptance checks fail.
- DON'T fake or mock an integration without labeling it clearly.
- DON'T leave `any`, `// @ts-ignore`, or silent `catch {}` blocks without justification.
- DON'T edit the database manually; migrations only.
- DON'T rotate `ENCRYPTION_KEY` casually; existing ciphertext becomes unreadable.

## Quick checklist before every PR
- [ ] No secrets, no message text in logs or DB
- [ ] Queries scoped by `user_id`
- [ ] Zod validation present
- [ ] Typecheck, lint, tests pass
- [ ] Loading/empty/error states handled
- [ ] Docs updated
- [ ] Nothing forbidden above was introduced
