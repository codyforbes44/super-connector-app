# SignalBox — rebrand, onboarding, and mobile-first release prep

Three phases: strip vendor names from everything a user can see, rebuild the visitor-to-signup journey around an instant free trial, then do a device-wide UX pass and make the app installable so it can be wrapped for Google Play.

## 1. Brand as SignalBox, mask the vendors

Every user-visible mention of Twilio, ElevenLabs, Resend, Stripe and Google APIs becomes SignalBox-native language. Code, file names, webhook paths and env vars stay exactly as they are — nothing about the running integrations changes.

Naming map used consistently everywhere:

| Today | Becomes |
| --- | --- |
| Twilio number / caller ID | SignalBox number / your number |
| Twilio Messaging Service | Sender pool |
| TwiML App / Voice SDK | In-app calling |
| Verify / Lookup | Verification / Number intelligence |
| ElevenLabs agent | AI receptionist / AI voice |
| Resend email log | Email delivery |
| Twilio API Console | Provider API Console (super-admin only, kept as an escape hatch) |

Also updated: page titles and meta descriptions on all public routes, marketing footer ("Built on Twilio" removed), manifest name, email template copy and sender labels, error and empty-state strings, settings help text, FAQ and How-it-works content. The "Bring your own Twilio account" positioning is replaced with plan-based messaging so the value prop no longer leaks the provider.

## 2. Homepage and onboarding

Rebuild the marketing homepage around a single conversion path, then hand off to a guided first run.

- Hero with one primary CTA ("Start free trial"), a live-feel product mock, and a benefit strip — no vendor jargon.
- Section flow: outcome-led value props, a 3-step "how it works", pricing preview with free-trial framing, FAQ teaser, closing CTA. Sticky mobile CTA bar.
- Signup: email + password or Google, one screen, no plan selection required. Trial starts immediately.
- New `/welcome` first-run wizard, resumable, with a progress checklist:
  1. Name your workspace
  2. Choose or connect a number
  3. Enable alerts (push + email)
  4. Send a first message or place a test call
- Persistent "Finish setup" checklist card in the app until complete; skipping anywhere is allowed.
- Trial state surfaced in-app (days left, upgrade CTA) using the existing subscription hook and plans.

Database: add onboarding progress and trial fields to the profile/subscription records so the wizard is resumable across devices.

## 3. Mobile-first UX refactor

Pass over every public and authenticated view with phone-first layout rules, then scale up to tablet and desktop.

- Public routes: single-column mobile stacks, larger tap targets, condensed nav with a full-screen mobile menu, desktop max-width containers.
- App shell: safe-area insets for notch and home bar, bottom tab bar with active glow, swipe-friendly sheets, sticky headers that collapse on scroll.
- Inbox, calls, numbers, tools, settings, subscribers, billing: wide tables become card lists on mobile with table layouts returning at `md:`; every text-plus-widget row gets the grid + `min-w-0` + `shrink-0` treatment so nothing clips.
- Consistent loading skeletons, empty states, error states and toast feedback.
- Optimistic query invalidation for refresh actions, and two-pane layouts for inbox and calls on larger screens.
- Accessibility: focus rings, labels on icon buttons, contrast check on the dark theme.

## 4. Google Play readiness (PWA now, TWA wrapper later)

- Full manifest: SignalBox name/short name, `id`, `scope`, `start_url`, `display: standalone`, theme/background colors, 192/512 and maskable icons, screenshots, categories.
- Icon set generated from the SignalBox mark; favicon and apple-touch-icon updated.
- Offline app shell via the guarded service-worker path (never registers in preview/dev/iframe, `?sw=off` kill switch), network-first HTML, cache-first for hashed assets, OAuth callback excluded.
- The existing push service worker stays untouched and keeps working.
- Add `/legal/privacy` and `/legal/terms` pages plus a store-listing summary, since Play requires a hosted privacy policy.
- Delivery note: this project ships the web app and manifest. The Play submission itself uses Bubblewrap or PWABuilder against the published domain with a Digital Asset Links file, which I'll add at `/.well-known/assetlinks.json` once you have the signing key fingerprint.

## Technical notes

- No integration wiring changes: connector gateway calls, webhook routes under `/api/public/*`, signature verification, push and OAuth flows all stay as-is.
- Masking is presentation-layer only — strings in route components, email templates, manifest and metadata.
- One migration for onboarding/trial fields, with GRANTs and RLS scoped to the owning user.
- Route heads get unique SignalBox titles, descriptions and OG tags per page.