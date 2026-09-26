# Twilio 401 "Authenticate" — diagnosis and fix

## What I verified

I tested all three ways the app talks to Twilio, using the credentials currently stored for this project:

| Path                                                            | Result                   |
| --------------------------------------------------------------- | ------------------------ |
| Direct call with Account SID + Auth Token                       | 401 `20003 Authenticate` |
| Direct call with the API Key SID + Secret                       | 401 `20003 Authenticate` |
| Lovable Twilio connection (gateway, its own stored credentials) | 401 `20003 Authenticate` |

The stored values are well-formed (Account SID `AC…` 34 chars, auth token 32 chars, API key `SK…` 34 chars), so this is not a formatting or code bug. Every credential attached to this Twilio account is rejected at the same time — including the one held separately by the Lovable connection.

That points at the Twilio account itself, not the app: the auth token was rotated, the API key was deleted, or the account/subaccount was suspended or closed. No app-side change can authenticate against it.

## Plan

### 1. Confirm the account state (you, in Twilio)

Sign in at twilio.com/console and check:

- Is the account active, or suspended / trial-expired / closed?
- Does the Account SID shown match the one the app is configured with? (I can print the first and last few characters for comparison without exposing the whole value.)
- Under Account → API keys & tokens: is the auth token the same one saved here, and does the `SK…` key still exist and show as active?

### 2. Refresh the credentials

Depending on what step 1 shows:

- **Auth token rotated** — save the current primary auth token again in the app's secrets, and reconnect the Twilio connection so the gateway picks up the new value.
- **API key deleted/revoked** — create a new API key with message and media read permission, and save the new SID + secret.
- **Account suspended or closed** — resolve billing with Twilio first; nothing else will work until it is active.
- **Different account than expected** — update all Twilio values together so the SID, auth token, API key, and the connection all point at the same account.

### 3. Re-verify end to end

Once new values are saved, I re-run the same three probes (account balance via direct auth, via API key, and through the connection) and confirm all return 200. Then I spot-check the surfaces that depend on each transport: numbers and messaging (gateway), Verify and Lookup v2 (direct), and the in-app voice token (API key).

### 4. Make the failure legible in the app

Today a rejected credential surfaces as a raw `Twilio request failed [401]` string wherever it happens. I will map Twilio error 20003 to one clear message — "Your phone service credentials were rejected. Reconnect Twilio in Settings." — with a link to Settings, and show a connection-status row that reflects live credential health rather than merely whether a secret exists.

## Technical notes

- `src/lib/twilio.server.ts` picks the transport by `host`: `api` goes through the Lovable connector gateway, everything else calls the subdomain directly with Basic auth from `TWILIO_ACCOUNT_SID` / `TWILIO_AUTH_TOKEN`. Both fail, so the fix is credential-side, not transport-side.
- Voice SDK access tokens are signed with `TWILIO_API_KEY_SID` / `TWILIO_API_KEY_SECRET`; if that key was deleted, in-app calling stays broken even after the auth token is fixed, so both must be refreshed.
- Step 4 is the only code change in this plan — the credential work happens in Twilio and in the project's saved secrets/connection.
