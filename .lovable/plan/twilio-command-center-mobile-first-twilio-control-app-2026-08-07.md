# Twilio Command Center — mobile-first Twilio control app

A mobile-first web app that gives a team full operational access to a Twilio account: messaging, voice, number/account admin, and Verify + Lookup. Built to beat Talkyto / Toktiv / Mango on breadth (all four Twilio surfaces in one app), live inbound, and per-agent number assignment.

## Design direction
Dark, dense, native-feeling: bottom tab bar (Inbox / Calls / Numbers / Tools / Settings), thumb-reachable composer, swipe actions on threads, sticky call bar. Deep ink surfaces with a single vivid signal accent, tight typographic scale, no card-soup. Desktop gets a wider two-pane split of the same views.

## What gets built

### 1. Foundation
- Enable Lovable Cloud (database, auth, storage) and link the existing Twilio connection to the project.
- Email/password + Google sign-in, `profiles` table (display name, avatar), separate `user_roles` table (`owner`, `admin`, `agent`) with a security-definer role check.
- Agents are assigned Twilio numbers; agents see only threads/calls on their numbers, admins see everything.

### 2. Messaging (SMS / MMS / WhatsApp)
- Unified inbox of conversations grouped by contact + number, unread badges, search, filters by channel and assigned number.
- Thread view: bubbles, media attachments, delivery/read status, send SMS, MMS (image upload to storage → public media URL), and WhatsApp from WhatsApp-enabled numbers.
- Live inbound via a public webhook endpoint that verifies the Twilio signature, stores the message, and pushes it to open clients in realtime.
- Scheduled sends, saved quick replies/templates, per-thread assignment to an agent, internal notes.

### 3. Voice
- Call log with direction, duration, status, cost, recording playback, and transcription when available.
- Click-to-call: originate a call from an assigned number to a contact and bridge to the agent's phone.
- Inbound call webhook + status callbacks logged to the database; missed-call notifications in the inbox.
- Per-number voice settings: forwarding target, voicemail greeting, business hours.

### 4. Numbers & account admin
- Number inventory with capabilities, monthly cost, assigned agent, and webhook wiring status; one-tap "wire this number to the app".
- Search and purchase available numbers by country/area code/capability; release numbers.
- Subaccount list, usage records and spend charts by category and period, balance, and messaging service overview.

### 5. Verify / 2FA + Lookup
- Verify: list services, start a verification (SMS/call/email), check a code, and view recent attempts.
- Lookup: phone number intelligence (validity, carrier, line type, caller name) with a lookup history saved per user.

### 6. Escape hatch — unrestricted API console
- An authenticated admin-only console to issue any Twilio REST call (method + path + params) through the gateway, with saved requests and pretty-printed responses. This is what makes coverage genuinely complete rather than only the curated screens above.

## Technical notes
- All Twilio calls run server-side through the Lovable connector gateway (`https://connector-gateway.lovable.dev/twilio/...`), form-encoded, never from the browser. The gateway injects auth and the Account SID.
- App logic uses TanStack `createServerFn` with `requireSupabaseAuth`; each handler re-checks the caller's role and number assignment before acting.
- Inbound webhooks live at `src/routes/api/public/twilio/{sms,voice,status}` and validate the `X-Twilio-Signature` HMAC before writing anything; they never return account data.
- Database tables: `profiles`, `user_roles`, `phone_numbers`, `number_assignments`, `contacts`, `conversations`, `messages`, `calls`, `templates`, `lookups`, `audit_log` — all with RLS scoped to role and number assignment, plus explicit grants.
- Realtime inbox updates via Cloud realtime subscriptions on `messages` and `calls`.
- Zod validation on every server function input; phone numbers normalized to E.164.

## Sequencing
1. Cloud + auth + roles + Twilio link, app shell and navigation.
2. Numbers inventory and assignment (everything else keys off numbers).
3. Messaging: inbox, thread, outbound send, inbound webhook + realtime.
4. Voice: log, click-to-call, recordings, inbound handling.
5. Verify, Lookup, usage/billing, subaccounts.
6. Admin API console, audit log, polish pass.

## Things to confirm as we go
- Twilio credentials must be a Main API Key (or a restricted key with message-media read) for MMS/WhatsApp media to load.
- Recommend enabling SMS Pumping Protection and Geo Permissions in the Twilio console before production sends.
- Click-to-call bridges to an agent's phone number; in-browser softphone (Twilio Voice SDK) is not included in this scope.
