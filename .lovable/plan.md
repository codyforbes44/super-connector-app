# Make call bridging optional on outbound calls

Today an outbound call from the dialer fails outright when in-app calling isn't
connected and no callback number is saved: `startCall` throws
"Add your phone number in Settings to place bridged calls." Bridging becomes
optional instead of required.

## Behaviour after the change

- In-app calling connected: unchanged, the call runs in the browser.
- Callback number saved: unchanged, we ring your phone first and bridge the contact.
- Neither available: the call still goes out. We dial the contact directly from
  your Twilio number using the resolved caller ID, and connect it to your in-app
  client if a device is online; if not, the contact hears a short connecting
  prompt and the call is logged like any other outbound call.
- No error toast blocks the Call button anymore.

## Dialer copy

The helper line under the dial keys reflects which path will run:
- "In-app call — connects right here using your caller ID."
- "We'll ring <your number> first, then connect the contact."
- "Direct call — dialing the contact from <caller ID>. Add a callback number in
  Settings to be bridged instead."

## Technical notes

- `src/lib/twilio-ops.server.ts` (`startCall`):
  - Remove the throw when `profiles.agent_phone` is empty.
  - Branch: with `agentPhone`, keep the existing bridge (To = agent phone,
    TwiML dials the contact). Without it, place To = contact, From = resolved
    caller ID, with TwiML that dials the user's voice client when a fresh
    `voice_presence` row exists for them, otherwise a brief `<Say>` prompt.
  - Log to `calls` with correct `from_number`/`to_number` in both branches and
    return a `mode: "bridge" | "direct"` field.
- `src/routes/_authenticated/calls.tsx`: derive the helper line from
  `voice.ready` and the saved callback number; adjust the success toast to match
  the mode returned by `startCall`.
- Unchanged: caller-ID resolution and routing rules, inbound handling, Settings
  callback-number field (still the preferred path, just no longer mandatory).
