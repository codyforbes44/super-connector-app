# Staging

Production (`main`) deploys to https://sixvox.3bi.io. Staging is a separate stack so a new workspace, subaccount, and A2P submission can be tried without touching live numbers or the parent Twilio account.

## Pieces

| Piece | Production | Staging |
| --- | --- | --- |
| Supabase | Lovable Cloud project used by sixvox.3bi.io | A second Supabase project. Apply every file in `supabase/migrations`, including `20260926120000_phase1_workspaces.sql`. |
| Twilio | Parent account. The founding workspace keeps using it until an owner runs Move numbers. | A subaccount created under the same parent (or a separate test account). Do not buy numbers on the parent from staging. |
| Web app | Cloudflare deploy of `main` | A second Cloudflare project (or preview) whose origin is `PUBLIC_BASE_URL`. |
| Stripe | Live webhook `?env=live` | Existing sandbox webhook `?env=sandbox`. Do not create or edit live Prices or Products. |
| A2P | Real TrustHub submissions cost money | Set `TWILIO_A2P_MOCK=true` so brand registration sends `Mock=true`. Never set that in production. |

`SIXVOX_ENV` is `development`, `staging`, or `production`. `publicBaseUrl()` reads `PUBLIC_BASE_URL` and otherwise stays `https://sixvox.3bi.io`.

## Environment variables

Set these on the staging Supabase/Cloudflare runtime. Do not commit values.

| Variable | Purpose |
| --- | --- |
| `SIXVOX_ENV` | `staging` |
| `PUBLIC_BASE_URL` | Staging origin, no trailing slash. Voice and SMS webhooks are built from it. |
| `SUPABASE_URL` | Staging project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Staging service role. Never the production key. |
| `SUPABASE_PUBLISHABLE_KEY` / anon key | Whatever the Vite client already expects for this project |
| `TWILIO_ACCOUNT_SID` | Parent (or staging) Account SID |
| `TWILIO_AUTH_TOKEN` | Matching auth token |
| `TWILIO_API_KEY_SID` | Parent API key, used for Voice SDK tokens while a workspace is still on the parent account |
| `TWILIO_API_KEY_SECRET` | Matching secret |
| `TWILIO_WEBHOOK_TOKEN` | Shared secret the webhook routes already check |
| `APP_USER_CONNECTION_KEY_SECRET` | Base64 32-byte key. Subaccount auth tokens and API key secrets are encrypted with it. Generate a staging key; do not reuse production. |
| `TWILIO_VERIFY_SERVICE_SID` | Verify service used by onboarding |
| `TWILIO_PRIMARY_CUSTOMER_PROFILE_SID` | Approved ISV primary Business Profile on the parent |
| `TWILIO_A2P_STATUS_EMAIL` | ISV email Twilio notifies. This is not the customer's email. |
| `TWILIO_A2P_MOCK` | `true` on staging only |

Stripe keys stay the ones the app already uses for sandbox versus live. Plan caps live in `plan_limits` and can be edited there without a price change.

## Twilio console (parent account)

- Trust Hub primary profile: business identity **ISV Reseller or Partner**, status Twilio Approved.
- The staging site's Voice URL, SMS URL, and status callback must be the staging `PUBLIC_BASE_URL`, not production. New number purchases write those URLs themselves.
- Do not point production numbers at staging.

## Check

1. Sign up on staging, verify a phone, create a workspace, claim one number.
2. Place the test call from the last onboarding step.
3. Confirm a second number purchase is rejected on the trial/Solo cap.
4. Confirm a second user cannot read the first workspace's threads.
5. Submit A2P only after the fee checkbox, and only with `TWILIO_A2P_MOCK=true`.
