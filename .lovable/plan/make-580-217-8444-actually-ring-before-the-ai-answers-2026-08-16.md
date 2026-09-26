# Make (580) 217-8444 actually ring before the AI answers

## What I verified on the live call

Your last test call (01:45 UTC today, from 972-360-8557) shows exactly what happened:

- Twilio hit SixVox correctly, and SixVox returned: a 24-second ring, then hand-off to ElevenLabs.
- The ring lasted **zero seconds** — the hand-off to ElevenLabs fired in the same second the call started, and the agent picked up immediately.
- Why: the "ring" is built as a call to an in-app device identity (`sixvox-ringback`) that is never registered. Twilio does not ring an unregistered device — it fails that leg instantly and moves straight to the next instruction. So the 18s → 24s change from last time never had any effect.
- ElevenLabs side is fine and is **not** the cause: the number is registered, bound to your agent, and answers the moment it is handed the call. ElevenLabs has no "wait N rings" setting — the ringing has to come from SixVox before the hand-off.
- Twilio wiring is clean: voice app + voice URL both point at SixVox, no drift.

## Changes to make

1. **Replace the fake ring with a real one.** Play an actual US ring-back tone audio to the caller for four cycles (~24s) instead of dialing a phantom device. This produces audible ringing that reliably lasts the full duration.
2. **Add the ring-back audio asset** (a standard US ring cadence: 2s tone, 4s silence) served from the app so it plays instantly with no external dependency.
3. **Apply it everywhere a caller waits**: the AI hand-off path and the voicemail path, in both inbound handlers, so behavior is identical whether or not one of your devices is online.
4. **Keep device ringing intact.** When one of your devices _is_ registered and online, the call still rings that device for the same window first; only the phantom-identity ring-back is replaced.
5. **Record the outcome** on each call row (`answer_path`) so the Advanced screen shows whether a call rang, went to the agent, or went to voicemail — right now that field is never written on this path.
6. **Verify with a live call** to (580) 217-8444: confirm four audible rings, then the agent greeting, and repeat for (580) 745-0045.

## Technical notes

- `src/lib/voice-answer.server.ts`: `ringbackTwiml()` changes from `<Dial><Client>sixvox-ringback</Client></Dial>` to `<Play loop="4">{ringback.mp3}</Play>`. Note this answers the call (Twilio bills from that point) — that is unavoidable for guaranteed audible ringing, and is what the AI path already does today.
- Ring-back audio added under `public/` and referenced by absolute URL via `webhookUrl`-style origin resolution.
- `src/routes/api/public/twilio/app-voice.ts`: write `answer_path` on the inbound branch, matching `voice.ts`.
- No ElevenLabs configuration change is needed; `ensureAgentPhoneNumber` already re-verifies the binding on every call.
