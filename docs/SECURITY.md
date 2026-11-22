# SECURITY — TG2WA

## 1. What is sensitive

| Asset | Sensitivity | Handling |
|---|---|---|
| Telegram session string | **Critical.** Equals full access to the user's Telegram account | AES-256-GCM at rest, decrypt only in worker memory, never logged, wiped on disconnect |
| Telegram login code / 2FA password | Critical, transient | Passed straight through to Telegram; never stored, logged or echoed |
| CallMeBot API key | High | AES-256-GCM at rest, decrypted only when sending |
| `ENCRYPTION_KEY`, `INTERNAL_API_SECRET`, `AUTH_SECRET`, `TELEGRAM_API_HASH` | Critical | Host env vars only; never in git or client bundles |
| Message text | High | In memory only while forwarding; **never persisted or logged** |
| Phone numbers | PII | WhatsApp number stored (needed to send); Telegram phone stored masked only |

## 2. Threat model (STRIDE-lite)

- **Stolen DB dump** → sessions/keys are ciphertext; useless without `ENCRYPTION_KEY` (kept outside the DB).
- **Compromised web app** → can reach worker API but needs `INTERNAL_API_SECRET` for signing; the worker accepts only signed requests with fresh timestamps.
- **IDOR** (one user reading another's data) → all queries filtered by session `user_id`; `userId` for the worker is injected server-side.
- **Brute-forcing login code endpoint** → attempt cap (5) and rate limits per user and IP.
- **Replay of internal requests** → timestamp window 60 s + signature over method/path/body hash.
- **Log leaks** → pino redaction + code review checklist + a test that greps logs for known secret patterns.
- **Two workers / session duplication** → advisory lock.
- **Abuse as a spam tool** → forwards go only to the user's own verified number; no custom destinations in v1; per-user queue rate limit.

## 3. Cryptography
- Algorithm: AES-256-GCM, random 12-byte IV per encryption, 16-byte auth tag. Stored as `base64(iv | tag | ciphertext)`.
- Key: 32 random bytes, base64 in `ENCRYPTION_KEY`. Same key in web and worker.
- Include a `keyVersion` prefix (e.g. `v1:`) in stored values to allow rotation later.
- Unit tests: round-trip, tamper detection (modify one byte → throws), wrong key → throws.

## 4. Web security checklist
- HTTPS only; HSTS; secure, httpOnly, sameSite=lax cookies.
- Security headers: CSP (no inline scripts except nonce), X-Content-Type-Options, Referrer-Policy, frame-ancestors none.
- Zod validation on all inputs; reject unknown keys.
- Rate limiting (Upstash or in-DB token bucket) on: send-code, verify-code, verify-password, whatsapp/test, sign-in.
- No secrets in `NEXT_PUBLIC_*` variables.
- Dependency audit in CI (`pnpm audit`), lockfile committed.

## 5. Worker security checklist
- Internal API behind HMAC; `/health` returns nothing sensitive.
- Run as non-root in Docker, minimal base image.
- Timeouts on every outbound request (CallMeBot 10 s).
- On Telegram auth errors: stop that client and clear nothing except status (user reconnects).
- Graceful shutdown on SIGTERM: stop accepting jobs, flush queue briefly, disconnect clients, release lock.

## 6. Privacy commitments (reflect in Privacy page)
- We store: account email/name (Google), encrypted Telegram session, masked Telegram phone, selected group ids and titles, WhatsApp number, encrypted CallMeBot key, delivery metadata for 14 days.
- We do not store: message text, media, contacts, chat history.
- Message text transits our worker and CallMeBot (third party) to reach WhatsApp.
- Users can disconnect Telegram (session is logged out on Telegram's side) and delete their account at any time.

## 7. Incident response (basic)
- Suspected key leak: rotate `ENCRYPTION_KEY` via migration script (decrypt with old, encrypt with new), rotate `INTERNAL_API_SECRET`, force all users to reconnect if unsure.
- Suspected DB leak: rotate all secrets, force Telegram session revocation (`auth.LogOut` per user), notify users.

## 8. Telegram and CallMeBot terms
- Use your own `api_id`/`api_hash`. Follow Telegram's API Terms of Service. Do not automate sending, joining or scraping on users' behalf.
- CallMeBot is a free third-party service. Read and respect its terms and rate limits. Show users the limitations.
