# Unlock Full Twilio Access

With `TWILIO_ACCOUNT_SID` and `TWILIO_AUTH_TOKEN` saved, the direct-API transport already built into the app can now reach every Twilio subdomain the connector gateway could not. This plan turns that on and hardens the webhooks.

## 1. Verify the credentials work

Call a harmless endpoint on each transport (account fetch, Lookup v2, Verify service list) and confirm real responses come back before touching UI.

## 2. Light up the gated features

These screens currently show "add your Account SID and Auth Token"; after verification they should work unchanged:

- **Tools → Verify**: create services, send and check OTPs (SMS, voice, email, WhatsApp).
- **Tools → Lookup**: Lookup v2 with line-type intelligence, caller name, SIM swap and reachability packages.
- **Console**: all non-`api` hosts (messaging, studio, conversations, insights, trusthub, numbers, events, sync, taskrouter, pricing, voice).

Remove the "credentials required" empty states and replace them with real error handling, and show a connection-status row in Settings (account name, type, status, balance) so it's obvious the direct transport is live.

## 3. Harden webhook authentication

Replace the query-string token check on the SMS, voice and status endpoints with real Twilio request-signature validation (`X-Twilio-Signature`, HMAC-SHA1 over the full URL plus sorted POST params, timing-safe compare). Keep the existing token as a fallback so nothing breaks while numbers are re-wired, and log rejected requests.

## 4. Add Messaging Services (A2P/10DLC)

A new section under Numbers to list Messaging Services, view the numbers in each pool, see A2P brand/campaign registration status, and pick a Messaging Service as the sender for outbound messages instead of a single number. This is the piece US business texting actually depends on and is a direct gap versus the competitors named.

## Technical notes

- `src/lib/twilio.server.ts` already routes `host: "api"` through the Lovable gateway and every other host directly with Basic auth from the new secrets — no transport rewrite needed.
- Signature validation uses Web Crypto HMAC-SHA1 (available in the Worker runtime); the raw form body must be read before parsing.
- Recording and media fetches can now use Basic auth directly rather than the gateway proxy, which simplifies `getRecordingAudio` and `signMediaUrl`.
- Secrets are read inside handlers only; nothing new is exposed to the browser.

## Not in this plan

In-app Voice SDK calling (needs a TwiML App SID plus an API Key SID/Secret), mirroring inbound media into storage, and AI features on the existing Lovable AI key. Say the word and I'll plan those next.