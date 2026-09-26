# A2P 10DLC registration in-app

US carriers block SMS from a 10-digit number unless it sits in a Messaging Service whose campaign is registered and approved. Today the app can create Messaging Services and read campaign status, but there is no way to actually register a brand or campaign — so the block can be seen, not fixed.

## What gets built

**1. Clear blocked-message explanation**
Twilio error 30034 (and the "unregistered A2P" variants) currently surfaces as a raw carrier error. Map it to a plain message — "This number isn't registered for US business texting yet" — with a direct link to the registration screen.

**2. A2P registration screen (admin only)**
A new step-by-step screen under Advanced showing the real registration chain and where it's stuck:

```text
Business profile  ->  Brand  ->  Campaign  ->  Number in pool  ->  Approved
```

Each step shows live status from Twilio (draft / pending / approved / failed) with the failure reason when Twilio rejects one.

**3. Submit registration from the app**

- Business profile: legal business name, EIN/Tax ID, business type and industry, address, website, and an authorized contact.
- Brand: submitted from the business profile; low-volume standard by default (cheapest, no vetting wait) with an option for standard brand.
- Campaign: use case (e.g. customer care / 2FA / mixed), campaign description, two sample messages, opt-in details and help/stop keyword handling.
- Attach the Messaging Service and its numbers to the approved campaign.

Fields are validated before submit, since carrier rejections cost money and time. Anything Twilio rejects comes back inline on the offending step.

**4. Status polling**
Registration takes hours to days. The screen refreshes status on open, and the messaging screen shows a small banner while a campaign is pending or rejected.

## Technical notes

- New ops in `src/lib/twilio-ops.server.ts` calling TrustHub v1 (`/v1/CustomerProfiles`, `/v1/TrustProducts`, end-user and supporting-document endpoints) plus Messaging v1 (`/v1/a2p/BrandRegistrations`, `/v1/Services/{sid}/Compliance/Usa2p`), exposed through `src/lib/twilio.functions.ts` behind the existing `requireAdmin` guard.
- Registration state (profile SIDs, brand SID, campaign SID, last known status and error) persists in a new `a2p_registrations` table with owner-scoped RLS and grants, so the flow can resume across sessions.
- UI: new `src/routes/_authenticated/a2p.tsx` plus a status card in `MessagingServices.tsx`; error mapping in `src/lib/format.ts`.
- These TrustHub endpoints are not on the connector gateway, so they run over the direct Twilio Account SID / Auth Token path (`api-direct`-style hosts). The credentials currently return 20003 Authenticate, so registration submits will fail until Twilio auth is restored — the screen will state that plainly rather than showing a generic error.

## Not included

- Toll-free verification (a separate process) — can be added after.
- Automatic re-submission after a carrier rejection; rejections are shown for manual correction.
