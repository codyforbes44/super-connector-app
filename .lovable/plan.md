# Fix the outbound dial dead-end

Dialing a contact currently fails with "Add your own phone number in Settings first — we call you, then the contact." whenever in-app calling isn't ready. The dialer stops there and gives no way forward.

## What's happening

The dialer has two paths:
1. In-app calling (browser voice) — used when the voice device is registered.
2. Call-me-then-connect — the fallback: we ring your own phone, then bridge the contact.

The fallback needs a personal number saved on your profile. That field is empty, so the server rejects the call.

## What to change

**Dialer (Calls screen)**
- When the fallback path is used and no personal number is saved, show an inline "Call me on" field right in the dial sheet instead of throwing an error toast.
- Enter the number once, tap Call: the call goes through and the number is saved to your profile so it never asks again.
- Show a small line above the Call button saying which mode will be used: "In-app call" or "We'll ring +1 555… first".

**Server**
- `startCall` accepts an optional `callbackNumber`; when present, use it and persist it to `profiles.agent_phone`. Keep the existing error only when neither a saved number nor an entered one exists.

**Settings → Calling**
- Move the "Your phone (for click-to-call)" field next to the default-number picker so callback setup lives with the rest of the calling config, and label it clearly as the number we ring for bridged calls.

## Technical notes

- `src/lib/twilio-ops.server.ts` — `startCall` gains an optional `callbackNumber`, normalizes and upserts it to the profile before placing the Twilio call; unchanged caller-ID resolution.
- `src/lib/twilio.functions.ts` — widen the `startCall` input validator.
- `src/routes/_authenticated/calls.tsx` — inline callback field in the dial sheet, mode hint derived from `voice.ready`, bootstrap invalidation after a save.
- `src/components/CallingSettings.tsx` — surface the callback number field.

Not touched: in-app voice registration itself, caller ID rules, inbound routing.
