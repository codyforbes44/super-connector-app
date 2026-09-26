# Fix "An application error has occurred" on +1 580-238-4777

## What I confirmed

- The two most recent inbound calls to +1 580-238-4777 (03:27 and 03:32 UTC today, both from +1 817-757-2828) did reach the app — call rows were written — so Twilio is pointed at SixVox correctly and the number answers.
- The number is set to **AI receptionist** mode with ElevenLabs agent `agent_5701…` and a cached ElevenLabs phone-number id `phnum_3401…`.
- In that mode the app answers with a ring-back, then hands the call to ElevenLabs with a `<Redirect>` to their Twilio inbound endpoint. If that hand-off returns anything Twilio can't read as TwiML, the caller hears exactly the generic "an application error has occurred" message.
- A separate confirmed problem: the Twilio connector gateway is returning **401 Authenticate** right now, so any code path still going through the gateway (rather than the direct account credentials) fails.

Root cause is not yet proven — the plan starts by capturing the actual Twilio error code rather than guessing.

## Plan

### 1. Capture the real error (first step)

- Add a Twilio error webhook endpoint that records Twilio Debugger alerts (error code, message, URL, call SID) into a small `webhook_errors` table, and point the account's debugger callback at it.
- Log the TwiML the voice webhook returns for each inbound call, plus the outcome of the ElevenLabs hand-off, so the failing leg is visible in the admin view.
- Surface recent errors on the Advanced/admin screen so they can be read without digging.

### 2. Make the call never fail hard

- Wrap the whole inbound voice handler in a guard: any unexpected failure returns valid voicemail TwiML instead of an error, so a caller always gets a greeting and can leave a message.
- Verify the ElevenLabs hand-off before using it (confirm the number is still registered and bound to the agent). If the check fails, fall back to the greeting + recording path instead of redirecting.
- Re-validate the cached `elevenlabs_phone_number_id`; if ElevenLabs no longer recognises it, clear it and re-register the number.

### 3. Fix the credential path

- Confirm every Twilio call in the app uses the direct account credentials, and remove/flag remaining gateway-dependent calls, given the gateway is returning 401.
- Add the gateway/credential health result to the connectors screen so this failure is visible early instead of showing up as a broken call.

### 4. Verify

- Place a test inbound call to +1 580-238-4777 and confirm: audible ringing, AI receptionist answers (or voicemail greeting if AI is unavailable), the call row completes, and no error is recorded.
- Repeat for +1 580-745-0045 and +1 580-217-8444, which share the same handler.

## Technical notes

- Files touched: `src/routes/api/public/twilio/voice.ts`, `src/lib/voice-answer.server.ts`, `src/lib/elevenlabs.server.ts`, `src/lib/twilio.server.ts`, plus a new `src/routes/api/public/twilio/error.ts` and a migration for `webhook_errors` (RLS + grants, admin read only).
- The ring-back uses `<Dial><Client>` against an identity that never registers; if the debugger shows a client-dial error code, that construct is replaced with a `<Play>`-based ring instead.
