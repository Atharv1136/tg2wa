# API SPEC

All web routes: JSON, Zod-validated, require an authenticated session unless stated. Errors use `{ error: { code, message } }` with correct HTTP status. Never include secrets or message text in any response.

## 1. Web API (`apps/web`)

### Status and account
| Method | Route | Body | Returns |
|---|---|---|---|
| GET | `/api/status` | – | `{ telegram:{status,displayName,username,phoneMasked,lastError}, whatsapp:{status,phoneMasked,verifiedAt,lastError}, forwarding:{status,enabled}, worker:{state,lastSeenAt}, counters:{sentToday,failedToday,lastSentAt}, setup:{telegram:bool,groups:bool,whatsapp:bool} }` |
| GET | `/api/logs?limit=50` | – | `{ items:[{id,time,groupTitle,status,error}] }` |
| DELETE | `/api/account` | `{confirm:"DELETE"}` | `204` |

### Telegram
| Method | Route | Body | Returns / Notes |
|---|---|---|---|
| POST | `/api/telegram/send-code` | `{phone}` E.164 | `{status:"code_sent"}`. Rate limit: 3 per 10 min per user |
| POST | `/api/telegram/verify-code` | `{code}` | `{status:"connected"}` or `{status:"password_required"}` |
| POST | `/api/telegram/verify-password` | `{password}` | `{status:"connected"}`. Password is passed through, never stored or logged |
| GET | `/api/telegram/groups` | – | `{ groups:[{id,title,type,selected}] }` |
| PUT | `/api/telegram/groups` | `{ chats:[{id,title,type}] }` | `{ saved:n }`. Replaces selection; pings worker |
| POST | `/api/telegram/disconnect` | – | `{status:"not_connected"}` |

Error codes: `INVALID_PHONE`, `CODE_INVALID`, `CODE_EXPIRED`, `PASSWORD_INVALID`, `FLOOD_WAIT` (include `retryAfterSeconds`), `LOGIN_EXPIRED`, `SESSION_EXPIRED`, `WORKER_UNAVAILABLE`.

### WhatsApp (CallMeBot)
| Method | Route | Body | Returns |
|---|---|---|---|
| POST | `/api/whatsapp/save` | `{phone, apiKey}` | `{status:"unverified"}`. Resets verification. Key encrypted before write |
| POST | `/api/whatsapp/test` | – | `{status:"pending_confirmation"}`. Rate limit: 3 per 10 min |
| POST | `/api/whatsapp/confirm` | `{received:boolean}` | `{status:"verified"}` or troubleshooting payload |

Error codes: `INVALID_PHONE`, `CALLMEBOT_REJECTED`, `CALLMEBOT_TIMEOUT`, `NOT_CONFIGURED`.

### Forwarding
| Method | Route | Body | Returns |
|---|---|---|---|
| POST | `/api/forwarding/start` | – | `{status:"running"}` or `409 PRECONDITIONS_NOT_MET {missing:[...]}` |
| POST | `/api/forwarding/stop` | – | `{status:"stopped"}` |
| PATCH | `/api/forwarding/settings` | `{includeSenderName?}` | updated settings |

## 2. Worker internal API (`apps/worker`)

All routes except `/health` require HMAC headers (see `ARCHITECTURE.md` §8). `userId` always comes from the **web server's verified session**, never from the browser.

| Method | Route | Body | Purpose |
|---|---|---|---|
| GET | `/health` | – | `{ok:true}` |
| POST | `/internal/telegram/send-code` | `{userId, phone}` | Start login |
| POST | `/internal/telegram/verify-code` | `{userId, code}` | Complete login or request password |
| POST | `/internal/telegram/verify-password` | `{userId, password}` | Complete 2FA |
| GET | `/internal/telegram/:userId/dialogs` | – | List groups |
| POST | `/internal/telegram/:userId/disconnect` | – | `auth.LogOut`, wipe session, stop client |
| POST | `/internal/whatsapp/test` | `{userId}` | Send test message via Sender |
| POST | `/internal/users/:userId/refresh` | – | Reconcile this user now |

## 3. Security requirements for every route
- Authenticate → authorize (resource belongs to user) → validate → act.
- Rate limit auth-sensitive endpoints (per user + per IP).
- Generic error messages to the client; detailed errors only in server logs (still without secrets).
- CSRF: rely on Auth.js and same-site cookies; mutating routes accept JSON only.
