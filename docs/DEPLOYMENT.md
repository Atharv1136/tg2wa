# DEPLOYMENT — TG2WA

## 1. Topology
- **NeonDB**: Postgres. Branches: `main` (prod), `dev`.
- **Vercel**: `apps/web`.
- **Worker host**: Railway, Fly.io, Render (paid always-on instance) or a small VPS. **Exactly 1 instance, always on, auto-restart.** Free tiers that sleep will break forwarding.

## 2. Owner checklist (manual steps)

### 2.1 Neon
1. Create project, region close to the worker host.
2. Keep branch `main` for production and create `dev`.
3. Copy **pooled** and **direct** connection strings for each branch.
4. Before every production migration: create a restore branch/snapshot.

### 2.2 Google OAuth
1. Google Cloud Console → APIs & Services → Credentials → OAuth client (Web).
2. Authorized redirect URIs: `http://localhost:3000/api/auth/callback/google` and `https://<your-domain>/api/auth/callback/google`.
3. Copy client ID/secret.

### 2.3 Telegram API credentials
1. Log in at my.telegram.org → API development tools → create an app.
2. Copy `api_id` and `api_hash`. Treat as secrets.

### 2.4 Generate secrets
```
openssl rand -base64 32   # AUTH_SECRET
openssl rand -base64 32   # ENCRYPTION_KEY  (back this up securely! losing it makes stored sessions unreadable)
openssl rand -base64 32   # INTERNAL_API_SECRET
```

## 3. Environment variables

**Vercel (web):** `DATABASE_URL` (pooled prod), `AUTH_SECRET`, `AUTH_URL`, `AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET`, `ENCRYPTION_KEY`, `INTERNAL_API_SECRET`, `WORKER_URL`.

**Worker host:** `DATABASE_URL_UNPOOLED` (direct prod), `TELEGRAM_API_ID`, `TELEGRAM_API_HASH`, `ENCRYPTION_KEY` (same as web), `INTERNAL_API_SECRET` (same as web), `PORT`, `LOG_LEVEL`.

Migrations run from CI or the owner's machine with `DATABASE_URL_UNPOOLED` pointing to the target branch.

## 4. Deploy steps

1. **Migrate prod DB:** `DATABASE_URL_UNPOOLED=<prod direct> pnpm db:migrate`.
2. **Deploy worker first**
   - Build from `apps/worker/Dockerfile` (multi-stage, Node 20 slim, non-root user, `CMD ["node","dist/index.js"]`).
   - Set env vars, **replicas = 1**, restart policy = always, health check `GET /health`.
   - Confirm logs show: "advisory lock acquired", "reconcile started".
3. **Deploy web to Vercel**
   - Root directory `apps/web`, install command `pnpm install`, build `pnpm build`.
   - Set env vars; set the production domain; add domain to Google OAuth redirect URIs.
4. **Connect web → worker:** set `WORKER_URL` to the worker's public HTTPS URL. Confirm `/health` OK and a signed internal call works from web.
5. **Monitoring:** UptimeRobot / Better Stack monitors on `https://<worker>/health` (1–5 min) and the web URL. Alert to email/Telegram.
6. **Deployments of the worker:** stop-then-start (not overlapping). The advisory lock makes a second instance wait/exit. Expect a few seconds of downtime; messages in that window are not replayed in v1.

## 5. Rollback
- Web: redeploy previous Vercel deployment.
- Worker: redeploy previous image tag.
- DB: restore from the pre-migration Neon branch/snapshot. Prefer forward-fix migrations over destructive rollbacks.

## 6. Smoke tests and QA scenarios (run in production)

1. Sign in with Google; sign out; sign in again.
2. Connect Telegram (no 2FA account) and (2FA account).
3. Select 2 groups; refresh page; selection persists.
4. Verify WhatsApp: test message arrives; "Yes" → verified.
5. Start forwarding. Post "test 1" in selected group from another account → arrives on WhatsApp in < 10 s with group name.
6. Post in an unselected group → nothing arrives.
7. Close the browser and laptop. Post "test 2" → arrives.
8. Post a photo without caption → nothing; photo with caption → caption arrives with 📎 note.
9. Post a 3,000-character message → arrives in 2+ parts, in order.
10. Redeploy the worker → no duplicate of earlier messages; new messages still forward.
11. Stop forwarding → post → nothing; Start → post → arrives.
12. Revoke the session from Telegram → Settings → Active sessions → dashboard shows "Reconnect needed" within ~1 minute; forwarding stopped.
13. Break the CallMeBot key (edit to a wrong key) → failures logged; WhatsApp becomes `degraded` after 5 consecutive failures; banner appears.
14. Kill the worker → Worker badge goes Offline within 90 s; recovers after restart.
15. Start a second worker locally against prod → it refuses to run (lock). **Do this only with a throwaway setup, never with a real user's session.**
16. Disconnect Telegram → session disappears from Telegram's active sessions; DB has no session ciphertext.
17. Delete account → all rows gone.
18. Grep production logs for: phone numbers, API keys, session strings, message text. Expect zero hits.

## 7. Operating notes
- Check dashboard/worker logs daily in the first week.
- Back up `ENCRYPTION_KEY` in a password manager. If lost, all users must reconnect Telegram and re-enter CallMeBot keys.
- Neon free-tier compute: constant worker activity keeps the DB awake; check usage limits and upgrade if needed.
- Costs to expect: Neon (free/paid), Vercel (free hobby), worker host (a few $/month). CallMeBot is free.
- Scaling beyond one worker instance requires sharding users across workers (each user pinned to exactly one worker). Not in v1.
