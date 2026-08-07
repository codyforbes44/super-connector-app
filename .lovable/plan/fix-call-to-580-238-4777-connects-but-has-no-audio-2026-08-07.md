# Fix: call to (580) 238-4777 connects but has no audio

## What actually happened

I pulled the Twilio record for that call (CAbb2c…a313, 22 seconds, inbound from
(580) 760-6391). Twilio logged **error 31921 — media stream failure** on it, and
two things in SixVox combined to produce dead air:

1. **The AI receptionist stream URL is the wrong one.** That number is set to
   "AI receptionist" with an ElevenLabs agent. We answer with
   `<Connect><Stream url="wss://api.elevenlabs.io/v1/convai/conversation?...">`.
   That endpoint speaks ElevenLabs' own audio protocol, not Twilio's Media
   Streams protocol, so Twilio opens the socket, exchanges nothing usable, and
   drops it — the caller hears silence. That is the 31921.
2. **Before the AI even runs, we ring the app for 20 seconds.** In-app calling
   is currently switched off: the calling app record in SixVox is not marked as
   the default, so the app never issues a voice token and no device is ever
   registered. The call still spends 20 seconds ringing nobody in silence
   before falling through.

## The fix

**1. Hand AI-answered calls to ElevenLabs' native Twilio handler**
- Ensure the number is registered with ElevenLabs (import it through their
  phone-numbers API, keyed on the agent already selected for the number) and
  cache the ElevenLabs phone-number id alongside the number.
- When `answer_mode = ai_agent`, answer the call by handing it to ElevenLabs'
  Twilio inbound endpoint instead of a raw `<Connect><Stream>`, so ElevenLabs
  drives the media in Twilio's own format.
- Keep the existing degrade path: if registration or the handoff fails, fall
  straight through to the classic greeting + record so a caller never gets
  silence again.

**2. Stop the silent 20-second client ring**
- Track whether any agent device is actually registered (persist a short-lived
  presence row per identity, refreshed while a device is registered).
- `app-voice` only emits `<Dial><Client>` for identities that are present. With
  nobody online, the call goes to the AI receptionist / voicemail immediately.
- When clients are dialed, add ringback so the caller hears ringing, not dead
  air.

**3. Turn in-app calling back on**
- Mark the existing calling app (already pointed at SixVox's webhooks) as the
  default, and make the Voice setup panel in Settings show clearly when no
  default is set, with a one-tap "Use this app".

**4. Make failures visible**
- Log Twilio's error notifications against the call row, and surface the answer
  path ("AI receptionist", "voicemail", "rang app") in Call history so a silent
  call is diagnosable from the app.

## Technical detail

- `src/lib/elevenlabs.server.ts`: replace `agentStreamUrl` with
  `ensureElevenLabsNumber(agentId, phoneNumber)` using ElevenLabs'
  phone-numbers import/list API; add an `elevenlabs_phone_number_id` column on
  `phone_numbers` (one migration, grants + RLS per convention).
- `src/lib/voice-answer.server.ts`: the `ai_agent` branch returns the ElevenLabs
  handoff TwiML; every throw path returns the classic voicemail TwiML.
- `src/routes/api/public/twilio/app-voice.ts`: filter identities by presence,
  add `<Dial ringTone="us">`, skip the `<Dial>` entirely when no one is online.
- New `voice_presence` table (identity, user_id, last_seen_at) written by
  `src/lib/voice-device.tsx` on register/heartbeat, cleared on destroy.
- `src/components/VoiceSetup.tsx` + `twilio-ops.server.ts`: default-app banner
  and `setDefaultTwimlApp` wiring.

## Verification

- Re-run an inbound call to (580) 238-4777 and confirm the ElevenLabs agent
  speaks, with no 31921 notification on the call.
- Confirm a call with no device online reaches the AI/voicemail in about a
  second instead of after 20 seconds of silence.
- Confirm the Settings voice panel reports the app as default and the device
  registers.