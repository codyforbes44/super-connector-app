# Rename SignalBox to SixVox

Replace the product name everywhere it appears, so the app, website, emails, install prompt and notifications all read "SixVox".

## What changes

- **Public website** — home, features, pricing, how-it-works, FAQ, contact, legal (privacy and terms), and the shared marketing header/footer.
- **App screens** — auth, welcome/onboarding, inbox, calls, numbers, receptionist, assistant, tools, connectors, console, settings, billing, subscribers.
- **Install / mobile** — app manifest name and short name (what shows under the icon on a phone home screen), plus notification texts in the background service worker and push messages.
- **Emails** — sender names and the shared email layout branding change from "Signalbox" to "SixVox". The sending domain (bookme.bet) and addresses (alerts@, team@) stay the same.
- **Page titles and share previews** — every route's title, description and social preview text.
- **Server-side copy** — user-facing strings in phone number, tools, connectors and lead-notification logic.

Around 118 references across 41 files.

## What does not change

- The Lovable URL (`super-connector-app.lovable.app`) and the email sending domain stay as they are — those are separate settings, and changing the URL would break existing webhook endpoints already registered with external services.
- Database tables, columns, and stored data.
- Colors, layout, icons and imagery — text only.

## Technical notes

- Case-sensitive replacements: `SignalBox` → `SixVox`, `Signalbox` → `SixVox`, `signalbox` → `sixvox` (only in non-identifier copy). No CSS classes or DB identifiers contain the name, so nothing structural is affected.
- Files touched include `public/manifest.webmanifest`, `public/push-sw.js`, all route files under `src/routes/`, brand-bearing components (`MarketingLayout`, `ComposeSheet`, `PushNotifications`, `VoiceSetup`, `MessagingServices`, tools panels), and server modules (`email.server.ts`, `email-templates/*`, `push.server.ts`, `twilio-ops.server.ts`, `tools-ops.server.ts`, `connectors-ops.server.ts`, `leads.server.ts`).
- After the rename, a typecheck run confirms nothing broke.
