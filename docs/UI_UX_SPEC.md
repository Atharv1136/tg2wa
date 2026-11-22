# UI / UX SPEC

Design direction: clean, calm, trustworthy. Dark and light themes (system default). Rounded cards, generous spacing, one accent colour. Mobile-first. Use shadcn/ui components, Tailwind, lucide icons. Apply the `frontend-design` skill guidance if available so it does not look like a generic template.

## 1. Pages

| Route | Access | Purpose |
|---|---|---|
| `/` | public | Landing page |
| `/sign-in` | public | Google sign-in |
| `/onboarding` | authed | 4-step wizard (until complete) |
| `/dashboard` | authed | Status + controls + logs |
| `/settings` | authed | Change groups, WhatsApp, disconnect, delete account |

Routing rule after sign-in: setup incomplete → `/onboarding` (resume at the first incomplete step); complete → `/dashboard`.

## 2. Landing page sections
1. **Hero:** headline "Never miss a Telegram message again." Sub: "Forward text from your Telegram groups to your own WhatsApp. Runs 24/7, even when this tab is closed." Primary CTA "Get started with Google". Secondary "How it works".
2. **How it works (3 steps):** Connect Telegram → Pick groups → Verify WhatsApp.
3. **Why it's different:** Runs in the background · No WhatsApp Business API · Text-only, your number only · Messages are never stored.
4. **Privacy & honesty block:** what we store (encrypted session, group ids, delivery metadata) and don't store (message text). Mention CallMeBot is a third-party service that delivers the WhatsApp message.
5. **FAQ:** Is it safe? Does it work when my laptop is off? Why CallMeBot? Can it forward media? (not yet) How do I stop it?
6. **Footer:** privacy, terms, contact.

## 3. Onboarding wizard

Persistent stepper: **1 Telegram · 2 Groups · 3 WhatsApp · 4 Start**. Each step shows a status chip. Steps unlock sequentially. State is read from the server so refresh/resume works.

### Step 1: Connect Telegram
- Input: phone with country picker (E.164).
- Button "Send code". Hint: "The code arrives inside your Telegram app (check the chat named *Telegram*) or by SMS. Don't share it with anyone."
- Code input (6-digit friendly, paste support), resend with countdown.
- If 2FA: password field, "Your password is sent securely and never stored."
- Success: shows Telegram name/@username with green check.
- Errors: inline, human wording (see §6).

### Step 2: Pick groups
- Searchable list with avatar initial, title, type badge, checkbox. Select all / Clear. Counter "3 selected".
- Empty state: "No groups found. Join a group on Telegram and refresh."
- Sync/refresh button. Loading skeletons.

### Step 3: Verify WhatsApp (CallMeBot)
- Numbered instructions pulled from the **current** official CallMeBot page (agent must check and keep text accurate; link to the source). General shape: add CallMeBot's number to contacts, send the activation phrase from your WhatsApp, wait for the reply containing your API key.
- Inputs: WhatsApp number (E.164), API key (password-style input with show/hide).
- "Save & send test message" → state `pending_confirmation` → "Did you receive the test message?" Buttons: **Yes, I got it** / **No**.
- "No" opens troubleshooting: wait up to a couple of minutes, check number format, re-activate with CallMeBot, check key, try again.

### Step 4: Review & start
- Summary of the three connections + selected groups count.
- Toggle "Show sender name in forwarded messages" (default on).
- Big **Start forwarding** button. On success → confetti-free, calm confirmation → `/dashboard`.

## 4. Dashboard

Top: page title + "Forwarding" master toggle (Start/Stop) with confirmation on stop.

**Status cards (2×2 on desktop, stacked on mobile):**
1. **Telegram:** badge (Connected / Reconnect needed / Not connected), account name, "Manage".
2. **WhatsApp:** badge (Verified / Degraded / Unverified), masked number, "Send test".
3. **Forwarding:** badge (Running / Stopped / Blocked), groups monitored count.
4. **Background worker:** badge (Online / Offline), "last seen 12 s ago".

**Stats row:** Forwarded today · Failed today · Last forwarded "2 min ago".

**Recent activity table (last 50):** time, group, status chip (Sent/Failed/Skipped), error reason on hover. No message text, ever.

**Banners (top, dismissible only when resolved):**
- Session expired → "Telegram was logged out. Reconnect to resume forwarding." [Reconnect]
- WhatsApp degraded → "Recent deliveries are failing. Check your CallMeBot key." [Fix]
- Worker offline > 5 min → "Our background service seems offline. We're on it. Your messages sent during downtime won't be forwarded."

Auto-refresh every 5 s while the tab is visible; pause when hidden.

## 5. Status badge colours
- Green: connected / verified / running / online
- Amber: pending / degraded / blocked
- Red: expired / failed / offline
- Grey: not connected / unverified / stopped

## 6. Copy for common errors
- Wrong code: "That code didn't match. Check it and try again."
- Expired code: "That code expired. We can send a new one."
- Wrong password: "Incorrect password. Try again."
- Flood wait: "Telegram asked us to wait {n} minutes before trying again."
- Login expired (worker restarted): "Your login session timed out. Please start again."
- CallMeBot rejected: "CallMeBot didn't accept that number or key. Re-check the activation steps."
- Preconditions missing: "Finish these steps first: {list}."

## 7. Settings page
- Groups: edit selection.
- WhatsApp: change number/key (re-verification required).
- Telegram: disconnect (confirm dialog explains forwarding will stop).
- Danger zone: Delete account (type DELETE to confirm).

## 8. Accessibility and quality
- All controls keyboard accessible, visible focus, aria-live for status changes and errors.
- Contrast WCAG AA. Respect `prefers-reduced-motion`.
- Every async action has loading, success and error states; buttons disable while pending.
