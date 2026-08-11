# SIM and eSIM integration — feasibility review

## Short answer

SixVox is an installable web app (PWA) built on Twilio voice/SMS. A real phone-number SIM or eSIM cannot be provisioned from a web app, and Twilio does not sell voice-capable consumer SIMs. So a true "SixVox SIM in your phone" is not implementable on the current stack without a carrier partnership and native apps.

What *is* implementable today are the practical benefits users actually want from an eSIM: a second line that rings on the device, and their existing carrier number flowing into SixVox.

## What blocks the real thing

- **eSIM install is OS-level.** Downloading an eSIM profile requires an SM-DP+ activation code handed to iOS/Android system settings (or a Carrier/eSIM entitlement in a native app). Browsers have no API for it.
- **Twilio has no consumer voice SIM.** Twilio Super SIM / Programmable Wireless is IoT data (and SMS on some plans) — no dialable voice line, not usable as the phone's cellular identity.
- **A SixVox-branded line needs an MVNO.** Issuing eSIMs means an agreement with an MVNO enabler (e.g. Gigs, Truphone/1Global, Airalo for data-only, or a carrier MVNO deal), KYC, number porting, and app-store native apps for the entitlement flow.

## Recommended path (three tiers)

**Tier 1 — Ship now, no partner required**
- Rename and expand the current Bring-Your-Own-Number flow into a **"Your lines"** hub: SixVox numbers + your carrier number in one place.
- Add an explicit **"Do I need an eSIM?"** explainer that steers users to conditional call forwarding (already built) as the zero-cost equivalent.
- Improve forwarding: per-carrier deep-linkable activation codes (`tel:` links that dial `*61*…`), a verify step that confirms a forwarded test call landed, and a clear "forwarding is active/off" state on the line card.
- Add **native dialer handoff**: let the user place a call over their cellular line from SixVox contacts (`tel:` link) while still logging it, for places with no data coverage.

**Tier 2 — Data-only travel eSIM (partner API, moderate effort)**
- Resell a data eSIM (Airalo Partner API or similar) so users abroad keep SixVox calling over data instead of roaming.
- In-app: plan browser, Stripe checkout, then show the QR code / universal activation link that the OS installs. No native app needed — we hand off an activation link, we don't install anything.
- This is the only eSIM feature realistically shippable from the current codebase.

**Tier 3 — SixVox as a real mobile line (MVNO, major program)**
- Partner with an MVNO enabler that provides eSIM provisioning + numbers.
- Requires native iOS/Android wrappers for the eSIM entitlement, KYC/identity, porting flows, regulatory (E911, CPNI, taxes).
- Multi-quarter effort with contracts; not a code change.

## Suggested next step

Implement Tier 1 now (pure frontend/backend work on existing tables), and if you want travel coverage, add Tier 2 behind a feature flag once a partner account exists.

## Technical notes

- Existing surface to build on: `byo_numbers` table, `src/lib/byo.server.ts`, `src/lib/byo.functions.ts`, `src/components/line/BringYourOwnNumber.tsx`, `src/components/line/ForwardingStatusCard.tsx`, `src/lib/forwarding-codes.ts`.
- Tier 2 would add: an `esim_orders` table (user, plan, iccid, activation code, status), a server function wrapping the partner API, and a Stripe line item — reusing the existing payments code in `src/lib/payments.functions.ts`.
- Nothing in Tier 1 or 2 touches the Twilio voice path.
