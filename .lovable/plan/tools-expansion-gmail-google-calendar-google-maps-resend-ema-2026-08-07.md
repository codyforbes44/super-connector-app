# Tools expansion: Gmail, Google Calendar, Google Maps + Resend email

Adds three new connected services to Signalbox and a full branded email layer sent from `bookme.bet` via Resend.

## Connections to link

- **Gmail**, **Google Calendar**, **Google Maps** — linked through the connector picker (approval cards appear in chat).
- **Resend** — linked for sending; all email goes out from your verified `bookme.bet` domain.

Note: the Gmail and Calendar connectors authorize **one shared account** (yours), not each teammate's own mailbox. Everyone in the workspace sees that account's mail/calendar. If you later want per-agent mailboxes, that's a separate per-user OAuth setup.

## Email (Resend, from bookme.bet)

A shared, brand-matched email design system (Midnight Dialer look: deep blue gradient header, glass card, mono metadata rows, dark-on-light body for inbox safety) with templates for:

1. **Missed call** — caller, number called, time, duration, click-to-call-back link.
2. **Voicemail** — same plus recording player link and transcript if available.
3. **New inbound message** — sender, thread preview, deep link into the thread.
4. **AI assistant call summary** — ElevenLabs summary, key details captured, full transcript turns.
5. **Account/admin** — teammate invite, welcome, number provisioned, and a low-balance / usage warning.
6. **Daily digest** (optional toggle) — rollup of unread threads and missed calls.

Per-user notification preferences in Settings: which of the above to receive by email, plus quiet hours and instant-vs-digest. Emails are sent from the existing webhook paths that already trigger push, so alerts stay in sync. Sender addresses: `alerts@bookme.bet` for event mail, `team@bookme.bet` for account mail, with reply-to set to the account owner.

## Gmail

- **Contact email panel**: on a conversation/contact, show recent Gmail threads with that person's address alongside SMS and call history.
- **Send email from the app**: compose and reply to a Gmail thread inside the contact view, so a phone conversation can continue by email.
- Emails sent this way go through Gmail (so they land in your sent folder); automated alerts go through Resend.

## Google Calendar

- **Upcoming events** panel in Tools and on a contact.
- **Book a follow-up** from a call or message thread: pick a slot, create an event with the caller's number/email as attendee, and drop the event link back into the thread.
- **AI assistant booking**: the ElevenLabs voicemail assistant can check free/busy on the number's configured calendar and book a slot during the call; the booking is written to Calendar and logged on the AI conversation record. Per-number settings for which calendar, slot length, buffer, and bookable hours.

## Google Maps

- **Caller location**: Lookup results and call detail show the carrier region/area-code location with a small map.
- **Contact address**: store an address on a contact, geocode it, and show a map card plus a directions link.
- **Places search** panel in Tools with address autocomplete, used to fill contact addresses.

## Technical notes

- New server modules: `src/lib/email.server.ts` (Resend gateway sender + React Email render), `src/lib/gmail.server.ts`, `src/lib/gcal.server.ts`, `src/lib/maps.server.ts`, each with a matching `*.functions.ts` for the UI. All connector calls go through `https://connector-gateway.lovable.dev/{connector_id}/...` with `LOVABLE_API_KEY` + the connection key; nothing touches the browser.
- Templates as React Email components under `src/lib/email-templates/` with a shared layout component; rendered server-side and POSTed to Resend `/emails`.
- Migration: `notification_prefs` table (per user: channel toggles, quiet hours, digest mode); `contacts` gains `email`, `address`, `lat`, `lng`, `place_id`; `phone_numbers` gains `calendar_id`, `booking_slot_minutes`, `booking_hours`, `booking_enabled`; `email_log` table for sent alert audit; `calendar_bookings` table linking a booking to a call/conversation. All with GRANTs + RLS mirroring existing role rules.
- Alert fan-out extends `src/lib/push.server.ts` recipient logic into a shared `notify()` that dispatches push + email per user prefs; called from `twilio/sms.ts`, `twilio/status.ts`, `elevenlabs/post-call.ts`.
- AI booking exposed to the assistant as a tool endpoint under `src/routes/api/public/elevenlabs/booking.ts`, token-guarded like the existing post-call webhook.
- Maps browser key (`VITE_LOVABLE_CONNECTOR_GOOGLE_MAPS_BROWSER_KEY`) used only for the map/autocomplete widgets; geocoding goes through the gateway.
- Tools screen becomes a scrollable tab set: Verify · Lookup · Email · Mail · Calendar · Places.
