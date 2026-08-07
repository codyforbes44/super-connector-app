# Connector & API Resource Review

## What is actually connected today

| Resource | Status | Notes |
|---|---|---|
| Twilio (`Cody's Twilio`, gateway-backed) | Linked to this project | Powers every messaging, voice, number and console feature |
| Lovable Cloud (database, auth, storage, realtime) | Enabled | Tables, RLS, `mms-media` bucket |
| Lovable AI key | Provisioned | Present, but no AI feature uses it yet |
| Web Push (VAPID keys) | Configured | Inbound message + missed call alerts |
| `TWILIO_WEBHOOK_TOKEN` | Configured | Shared secret in the webhook query string |
| `ELEVENLABS_API_KEY` | Stored secret, unused | No code references it |
| Workspace connectors not linked | Gmail, Resend, Maps, Firecrawl, Perplexity, Semrush, TikTok, Calendar | Available if wanted |

## Findings and advice

1. **Twilio coverage is partial by design.** The connector gateway only reaches `api.twilio.com/2010-04-01/Accounts/{Sid}`. Verify, Lookup v2, Messaging Services (A2P/10DLC), Studio, Conversations, TaskRouter, Insights and TrustHub live on other subdomains and currently return the "add your Account SID and Auth Token" message. Saving a Twilio Account SID + Auth Token is the single highest-impact step — the server layer already dual-routes, so it unlocks that surface with no rewrite.

2. **Biggest functional gap: in-app calling.** Calls today are Twilio-bridged (Twilio rings your phone, then the contact). Talkyto/Toktiv/Mango dial from inside the app via Voice SDK access tokens, which needs a TwiML App SID, API Key SID/Secret and a push credential.

3. **Webhook auth should be upgraded.** Endpoints are protected by a token in the URL query string. Twilio signs every request with `X-Twilio-Signature`; validating that is the standard, stronger approach — also unlocked by having the Auth Token.

4. **Media handling.** Inbound MMS/WhatsApp media are stored as Twilio-hosted links needing account auth, proxied at view time. Copying media into the `mms-media` bucket on receipt makes threads faster and survives Twilio's retention window.

5. **Unused resources.** `ELEVENLABS_API_KEY` is referenced nowhere — either remove it or put it to work (voicemail greetings, AI voice replies). `LOVABLE_API_KEY` must stay (the Twilio gateway needs it) and could also power thread summaries, smart replies and transcription cleanup at no extra key cost.

6. **Optional connectors that fit.** Resend for email fallback/daily digests; Gmail if agents should reply from one inbox. Maps, TikTok, Semrush, Firecrawl and Perplexity are not relevant to this product.

7. **Operational safety.** Before real traffic, enable SMS Pumping Protection and tighten SMS Geo Permissions in the Twilio console — the composer and raw console can send to arbitrary destinations.

## Suggested order of work

1. Save Twilio Account SID + Auth Token, then confirm Verify/Lookup/Messaging tabs light up.
2. Switch webhooks to `X-Twilio-Signature` validation.
3. Add Messaging Service / A2P registration and Conversations screens.
4. Add in-app Voice SDK calling (TwiML App + API Key).
5. Mirror inbound media into storage.
6. Decide on ElevenLabs: use it for voice, or delete the secret.

This review changes no code. Tell me which items to take on and I'll plan the build.