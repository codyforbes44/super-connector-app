# In-app calling with a custom TwiML App

Signalbox will create and manage its own TwiML App (the Signalbox equivalent of
Mango-TwiML-App), then use it to place and receive calls directly inside the
app — no bridging through your personal phone.

## What you get

- A **TwiML App** created in your Twilio account from Settings, with all six URLs
  (voice request/fallback/status, messaging request/fallback/status) pointed at
  Signalbox automatically. You can view its SID, re-point the URLs, and see
  which numbers use it.
- **Numbers wired to the app**: wiring a number can attach the TwiML App instead
  of raw URLs, so re-pointing one app re-points every number at once.
- **Real in-app calling**: tap a contact or dial a number and the call runs in
  Signalbox with audio through the device — mute, hold, DTMF keypad, speaker,
  live call timer, and hang up.
- **Inbound calls ring in the app**: if you're online, an incoming-call screen
  appears with Accept / Decline. Decline (or nobody online) falls back to the
  existing forward-to-phone or voicemail behaviour, so nothing is lost.
- Every in-app call still lands in Call history with recording and status.

## Two things to know

- Placing calls in the browser requires a **Twilio API Key**. Signalbox will
  create one automatically using your saved account credentials and store the
  secret securely — no action needed from you.
- Microphone permission is requested the first time you call. On iPhone, use
  the Home-Screen-installed version of Signalbox for reliable mic and
  background audio.

## Technical detail

**Database** (one migration)
- `twiml_apps` table: `sid`, `friendly_name`, `voice_url`, `sms_url`,
  `is_default`, timestamps. Admin-managed, readable by authenticated users,
  with grants and RLS per project convention.
- `calls`: add `client_identity` and `answered_in_app` columns.

**Server layer**
- `twilio-ops.server.ts`: `listTwimlApps`, `createTwimlApp` (POST
  `/Applications.json` with `VoiceUrl` / `VoiceFallbackUrl` / `StatusCallback`
  pointing at `/api/public/twilio/app-voice`, and `SmsUrl` / `SmsFallbackUrl` /
  `SmsStatusCallback` pointing at the existing sms and status routes, all
  `POST`), `updateTwimlApp`, `deleteTwimlApp`, `setDefaultTwimlApp`.
  `wireNumber` gains an option to set `VoiceApplicationSid` and
  `SmsApplicationSid` instead of per-number URLs.
- `voice-token.server.ts`: ensures a Twilio API Key exists (POST `/Keys.json`
  with the account credentials; secret stored once as `TWILIO_API_KEY_SID` /
  `TWILIO_API_KEY_SECRET`), then mints a short-lived Voice Access Token (JWT,
  HS256 via Web Crypto) with an outgoing grant bound to the default TwiML App
  SID and `incomingAllow: true`. Identity is `agent_<supabase user id>`.
- `twilio.functions.ts`: `getVoiceToken` (per signed-in user) plus the
  admin-only TwiML App CRUD functions.

**Webhook** — new `src/routes/api/public/twilio/app-voice.ts`
- Signature-verified like the other webhooks.
- Outbound leg (`From` starts with `client:`): resolve the caller identity to a
  Signalbox user, verify they may use the requested caller-ID number, return
  `<Dial callerId=...><Number>` with recording and status callback.
- Inbound leg (`To` is one of our numbers): `<Dial timeout="20"><Client>` for
  each eligible agent; on no-answer, fall through to the existing forward or
  voicemail TwiML. Writes the `calls` row exactly as `voice.ts` does today.
- The existing `voice.ts` route stays for numbers wired the old way.

**Client**
- Add `@twilio/voice-sdk`. New `src/lib/voice-device.ts` hook: lazy-loads the
  SDK client-side only, fetches a token, registers the Device, refreshes on
  `tokenWillExpire`, and exposes call state.
- `src/components/InCallScreen.tsx`: full-screen Midnight-Dialer call UI —
  ringed avatar, name/number, timer, and the glossy circular control grid
  (mute, keypad, speaker, hold, add, end) matching the current design.
- `src/routes/_authenticated/calls.tsx`: the dial pad Call button starts an
  in-app call by default, with a "Call my phone instead" fallback to the
  existing bridge flow.
- Incoming-call sheet mounted in `_authenticated/route.tsx` so it can ring on
  any screen; the existing push notification covers missed in-app calls.
- Settings gains a **TwiML App** panel (create, view SID, edit URLs, set
  default) plus a mic-permission and device-registered status row.

**Verification**
- Create the TwiML App against the live account and confirm its URLs read back.
- Mint a token and assert the JWT decodes with the right grant and app SID.
- Signature-test `app-voice` for both the client-outbound and inbound branches.