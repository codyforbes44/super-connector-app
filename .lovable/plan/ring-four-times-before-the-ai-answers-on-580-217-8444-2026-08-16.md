# Ring four times before the AI answers on (580) 217-8444

## What I verified

- The number is set to **AI agent** answering (agent `agent_5701ky...`), assigned to your account, no call forwarding, fallback = voicemail.
- Twilio routes its incoming calls through the SixVox app (the "sixvox" voice app), so the app decides what happens — good.
- **It does not ring four times today.** Current behavior:
  - If one of your devices is registered and online: the app rings it for **18 seconds (3 ring cycles)**, then hands off to the ElevenLabs agent.
  - If no device is online (app closed/backgrounded past ~90s, or no browser/app session): the AI agent answers **immediately, with zero rings**.
- One loose end: on Twilio, the number's plain voice URL still points at ElevenLabs directly. The voice app takes precedence, so it's inert today, but it's a landmine if the app assignment is ever cleared.

## Changes to make

1. **Ring for four cycles.** Raise the ring window from 18s to **24s** (4 US ring cycles) for this AI-agent path, so the caller hears four rings before the hand-off.
2. **Always ring before the AI answers.** When AI answering is on and no device is online, play a 24s ring-back to the caller first, then redirect to the ElevenLabs agent — instead of the agent picking up instantly.
3. **Clean up the Twilio number config** so the number's voice URL and status callback point back at SixVox rather than ElevenLabs, keeping the app in control of every inbound call.
4. **Verify end to end** by placing a live test call to (580) 217-8444 and confirming four rings, then the agent greeting.

## Technical notes

- `src/lib/voice-answer.server.ts`: `RING_SECONDS` 18 → 24; add a ring-before-handoff helper so a `<Redirect>` to ElevenLabs is preceded by `ringbackTwiml()`.
- `src/routes/api/public/twilio/app-voice.ts`: in the `identities.length === 0` branch, stop returning the bare `<Redirect>` for `handOff`; prefix it with the ring-back. Keep the immediate-forward behavior for `forward_to` lines unchanged.
- `src/routes/api/public/twilio/voice.ts`: same adjustment where `handOff` currently skips `ringbackTwiml()`.
- Twilio rewiring done through the existing number-sync path so it isn't undone on the next sync.
