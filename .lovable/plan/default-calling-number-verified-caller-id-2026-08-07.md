# Default calling number + verified caller ID

Two related additions to outbound calling:

1. Pick one of your active SignalBox numbers as your **default** — the dialer, composer and click-to-call all start from it instead of whichever number happens to be first.
2. Attach a **verified caller ID** (a personal or office number you've verified) to a SignalBox number, so outbound calls from that number can display the verified number to the person you're calling.

## What you'll see

**Settings → Calling**

- "Default number" picker listing every active number assigned to you. Saved per user, so each teammate gets their own.
- "Verified caller IDs" section: lists the caller IDs already verified on the account, plus an "Add caller ID" flow. You enter a number, we place a short verification call that reads out a 6-digit code, you enter that code on the phone, and it appears in the list once verified. You can also remove one.

**Numbers → number detail**

- New "Outbound caller ID" picker on each number: "Show this SignalBox number" (default) or any verified caller ID. Admins only, matching the other per-number settings.

**Dialer**

- The From picker preselects your default number and shows a small "Default" tag next to it.
- When the selected number has a verified caller ID attached, a line under the picker reads "Recipients see +1 555…".

## Behaviour

- Outbound calls (both in-app calls and the call-me-then-connect path) use the number's verified caller ID when one is set, otherwise the SignalBox number itself.
- If a caller ID is deleted or unverified on the provider side, calls fall back to the SignalBox number rather than failing.
- Inbound routing, AI receptionist and messaging are unchanged — caller ID applies to outbound voice only.

## Technical notes

Database migration:

- `profiles.default_number text` — per-user default; cleared automatically if the number is unassigned.
- `phone_numbers.outbound_caller_id text` — verified caller ID to present, null = use the number itself.

Server (`src/lib/twilio-ops.server.ts`):

- `listCallerIds` / `requestCallerIdVerification` / `deleteCallerId` wrapping Twilio `/OutgoingCallerIds.json` and `/Validation Requests.json` through the connector gateway (admin-gated, audit-logged).
- `setDefaultNumber(sid)` and `setOutboundCallerId(sid, callerId)`; the latter validates the value against the account's verified caller IDs before saving.
- `startCall` resolves the effective caller ID from `phone_numbers.outbound_caller_id` before building the `<Dial callerId>` TwiML.

Voice webhook (`src/routes/api/public/twilio/app-voice.ts`):

- The client-outbound branch currently rejects any `CallerId` not present in `phone_numbers`. It will resolve the caller ID server-side from the requesting user's number instead of trusting the client value, keeping the existing anti-spoofing check intact and still logging `app_number` as the SignalBox number.

Client:

- `src/lib/twilio.functions.ts` — server functions for the new ops.
- `src/components/CallerIdSettings.tsx` — verified caller ID list + verification sheet, mounted in Settings alongside the new default-number picker.
- `src/routes/_authenticated/calls.tsx` — From picker defaults to `profile.default_number`, shows the presented caller ID.
- `src/routes/_authenticated/numbers.tsx` — per-number outbound caller ID picker.
