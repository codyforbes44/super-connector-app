# Update Twilio credentials

## Fastest path (no code needed)
Twilio credentials live as project secrets, not app data, so the safest place to type them is the secure secret form. On approval I open one form with four fields:

- `TWILIO_ACCOUNT_SID` — starts with `AC`, 34 chars
- `TWILIO_AUTH_TOKEN` — current primary auth token, 32 chars
- `TWILIO_API_KEY_SID` — starts with `SK` (needed for in-app calling)
- `TWILIO_API_KEY_SECRET` — shown only once when the key is created

Values are stored encrypted and never appear in the codebase or chat. The gateway-backed Twilio connection holds its own copy, so I also offer a reconnect card for that one.

After saving I re-run the three credential probes (gateway balance, direct account fetch, API-key signing) and report which come back green.

## In-app entry screen (optional, say if you want it)
If you also want a visible screen inside SixVox for this:

- New **Carrier credentials** card in Settings → Advanced, admin only.
- Four masked inputs matching the names above, each showing current state as "saved · ends ···1234" rather than the value.
- A **Test connection** button that runs `credentialHealth()` and shows per-transport status (gateway / direct / voice key).
- Save writes through a server function that stores the values as project secrets; nothing is persisted in the database and nothing is returned to the browser.

## Technical notes
- Reads stay on `process.env` in `src/lib/twilio.server.ts`, `voice-token.server.ts`, and `twilio-signature.server.ts` — no transport changes.
- The health probe already exists (`credentialHealth()`); the screen reuses it instead of adding new checks.
