# PRD — TG2WA (Telegram → WhatsApp Forwarder)

Version 1.0 · Status: Ready to build

## 1. Overview

TG2WA lets a person receive messages from Telegram groups on their own WhatsApp number, automatically and continuously, without keeping any website, phone app or laptop open.

## 2. Problem

People are members of many Telegram groups (alerts, study groups, deals, announcements, communities) but check WhatsApp far more often. Missing important messages is common. Official WhatsApp Business/Cloud API is heavy: business verification, templates, pricing. Users want a simple personal forwarder.

## 3. Goals

- G1: Forward text messages from selected Telegram groups to the user's own WhatsApp number within seconds.
- G2: Work 24/7 independent of the browser.
- G3: Simple onboarding: under 5 minutes from landing page to first forwarded message.
- G4: Clear, honest status: the user always knows whether it is working.
- G5: Safe by default: encrypted secrets, no message storage.

## 4. Non-goals (v1)

- Forwarding to anyone other than the user's own number.
- Media, files, voice, stickers, polls (text only).
- WhatsApp → Telegram (reverse direction).
- Official WhatsApp Business API.
- Team/multi-seat accounts, billing, public API.
- Telegram bots (we read as the user's own account so it works in groups where bots can't be added).

## 5. Users

**Primary:** an individual who is in several Telegram groups and wants those messages on WhatsApp. Moderately technical; comfortable entering a Telegram login code and a CallMeBot key.

## 6. User stories

- As a visitor, I understand what the product does from the landing page and can sign in.
- As a new user, I connect Telegram by entering my phone number, the login code, and (if enabled) my 2FA password.
- As a user, I see all my Telegram groups and select which ones to forward, with search and select all/none.
- As a user, I verify WhatsApp via CallMeBot, receive a test message, and confirm.
- As a user, I start/stop forwarding with one click.
- As a user, I see Telegram status, WhatsApp status, Forwarding status, last forwarded time, and recent logs.
- As a user, I can close the website and forwarding continues.
- As a user, I'm told clearly if something breaks (session revoked, CallMeBot failing) and what to do.
- As a user, I can change groups, disconnect Telegram, or delete my account and all data.

## 7. Functional requirements

### Auth
- FR-A1: Sign in with Google (Auth.js). Sign out. Protected routes redirect to sign-in.
- FR-A2: First sign-in creates the user and routes to onboarding; returning users with completed setup go to the dashboard.

### Telegram connection
- FR-T1: User enters phone in international format; app requests a login code via the worker.
- FR-T2: User enters the code. If the account has 2FA, prompt for the password.
- FR-T3: On success, the session string is encrypted and stored; the phone number is **not** stored in full (store masked last 4 digits only, for display).
- FR-T4: Show the connected Telegram name/username.
- FR-T5: Disconnect: log out the session on Telegram's side, delete the stored session, stop forwarding.
- FR-T6: Detect revoked/expired sessions and set status `session_expired`, stop forwarding, prompt to reconnect.

### Group selection
- FR-G1: List groups, supergroups and channels the user can read, with title and type.
- FR-G2: Multi-select with search, select all, clear. Persist selection.
- FR-G3: Changing selection takes effect in the worker within 10 seconds (web pings worker; worker also reconciles every 60 s).
- FR-G4: A user must select at least 1 group to start forwarding.

### WhatsApp (CallMeBot)
- FR-W1: UI shows the **current** official CallMeBot activation instructions (agent must check the CallMeBot site; do not hardcode from memory) and a link to them.
- FR-W2: User enters WhatsApp number (E.164) and CallMeBot API key. API key is encrypted at rest.
- FR-W3: "Send test message" sends a test via CallMeBot. Status `pending_confirmation`.
- FR-W4: User clicks "I received it" → status `verified`. "I didn't get it" shows troubleshooting.
- FR-W5: Re-verification possible any time; changing the number or key resets status to `unverified`.

### Forwarding
- FR-F1: Worker listens to new messages for all active chats of all users with forwarding enabled.
- FR-F2: Forward only text (see §9 rules). Format below.
- FR-F3: Exactly-once: unique `(user_id, tg_chat_id, tg_message_id)`.
- FR-F4: Per-user queue, ~1 message per 2 s, retries with backoff (5 s, 20 s, 60 s), then mark `failed`.
- FR-F5: Do not forward the user's own outgoing messages (default).
- FR-F6: Start/Stop toggle persisted in DB; worker obeys within 10 s.
- FR-F7: Forwarding cannot be enabled until Telegram connected, ≥1 group selected, WhatsApp verified.

### Dashboard
- FR-D1: Cards: Telegram, WhatsApp, Forwarding, Worker. Each with status badge and last-updated.
- FR-D2: Counters: forwarded today, failed today, last forwarded time.
- FR-D3: Recent delivery log (last 50): time, group, status, error if any. **No message text.**
- FR-D4: Auto-refresh every 5 s while the tab is visible.

### Account
- FR-X1: Delete account: log out Telegram session, delete all rows, sign out.

## 8. Edge cases and expected behavior

| Case | Expected behavior |
|------|-------------------|
| Wrong login code | Inline error, allow retry (max 5, then ask to restart) |
| Code expired | Offer "Send a new code" |
| 2FA password wrong | Inline error, retry |
| Telegram FloodWait on login | Show wait time, disable button until done |
| Login code arrives inside Telegram app, not SMS | UI hint: check your Telegram app's "Telegram" chat |
| Session revoked from phone | `session_expired`, forwarding stopped, dashboard banner + reconnect |
| User leaves/gets kicked from a group | Chat disappears from list on next sync; marked inactive |
| CallMeBot returns error/timeouts | Retry with backoff; after 3 fails mark `failed`; if 5 consecutive failures, set WhatsApp status `degraded` and show banner |
| CallMeBot rate limit | Queue slows; no message loss within retry window |
| Worker restarts | Reconnects all sessions; dedupe table prevents duplicates; messages arriving during downtime are **not** replayed in v1 (documented) |
| Very long message | Split into parts ≤ 1,500 characters labeled `(1/2)`, `(2/2)` |
| Edited message | Ignored in v1 |
| Deleted message | Ignored |
| Very active group | Per-user queue cap 200; overflow marked `skipped` and surfaced as a warning |
| Duplicate sign-in tabs | Safe; server is source of truth |
| Two workers started by mistake | Second exits because it cannot take the advisory lock |

## 9. Message rules and format

- Forward only if the message has non-empty text. Media-only → skip (counted as `skipped`).
- Media with caption → forward caption + ` 📎 (media not forwarded)`.
- Service messages (joins, pins) → skip.
- Format:

```
📩 {Group title}
👤 {Sender name}   (omit line if user disabled sender names)

{message text}
```

## 10. Status model

- **Telegram:** `not_connected` · `code_sent` · `password_required` · `connected` · `session_expired` · `error`
- **WhatsApp:** `unverified` · `pending_confirmation` · `verified` · `degraded`
- **Forwarding:** `stopped` · `running` · `blocked` (preconditions not met or an upstream is broken)
- **Worker (derived):** `online` if heartbeat < 90 s old, else `offline`

## 11. Non-functional requirements

- Availability target: worker uptime ≥ 99% (auto-restart, health check, uptime monitor).
- Latency: p95 Telegram message → CallMeBot request < 10 s under normal load.
- Security: see `SECURITY.md`.
- Privacy: no message content stored or logged.
- Scale target v1: up to ~50 users, ~10 groups each, on one worker instance.
- Accessibility: keyboard navigable, WCAG AA contrast.
- Browser support: latest Chrome, Safari, Firefox, mobile browsers.

## 12. Success metrics

- Time to first forwarded message < 5 min (median).
- Onboarding completion rate > 70% of users who sign in.
- Duplicate forward rate = 0.
- Delivery success rate > 98% of attempted forwards.

## 13. Risks and mitigations

| Risk | Mitigation |
|------|------------|
| CallMeBot is free/third-party, may be slow or change | `Sender` interface, clear status/banners, README notes, alternate sender later |
| Telegram restricts accounts used by automation | Read-only listening, personal use, low volume, no auto-joining/sending; one shared `api_id` could attract limits at scale |
| Session theft | AES-256-GCM, key in env only, no logs, delete on disconnect |
| Neon compute never sleeps due to polling | Poll no faster than 60 s; use web→worker ping for instant changes; document cost |
| Two worker instances kill sessions | Advisory lock + single replica config |
| Messages lost during worker downtime | Documented in v1; catch-up in v1.1 |

## 14. Release plan

- **v1 (this PRD):** everything above.
- **v1.1:** catch-up of messages missed during downtime, keyword include/exclude filters, quiet hours, daily digest option.
- **v2:** media links, second sender (whatsapp-web.js or other), Telegram bot mode.

## 15. Assumptions (confirm before building)

- Google sign-in is acceptable (email/password can be added later).
- One Telegram `api_id`/`api_hash` (from my.telegram.org) owned by the developer is used for all users.
- Worker hosting budget of a few dollars/month is acceptable.
