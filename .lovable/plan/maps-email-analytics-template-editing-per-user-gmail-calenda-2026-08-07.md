# Maps, Email Analytics, Template Editing, Per-User Gmail, Calendar Sync

Five upgrades to the Tools area and the email system.

## 1. Faster Places search + saved favorites with directions

- Debounced, cancellable place search with a short-lived result cache so repeat queries return instantly; results appear as you type instead of on submit.
- New "Favorites" section in the Maps panel: save any place or geocoded address with a nickname and label (Office, Client site, etc.).
- Each favorite gets one-tap actions: Directions (route link from a chosen origin or current location), Call (when the place has a phone), Copy address, Remove.
- Recent searches list, kept per user.

## 2. Email delivery analytics

- New "Delivery" view in the Email log tab: per-recipient rows with status (sent, delivered, bounced, complained, opened, clicked, failed), template, subject, timestamp and provider message ID.
- Filters by template, status, recipient and date range, with summary counters for the selected window.
- Failure detail drawer showing the provider error text plus a Retry action that re-sends the same email and links the retry back to the original row.
- Open/click tracking enabled on outbound sends and ingested through a new signed Resend webhook that updates rows as events arrive. Where tracking is unavailable, rows show "not tracked" rather than a false zero.

## 3. Editable branded email templates

- New "Templates" tab listing every communication type (missed call, voicemail, inbound message, AI summary, account, daily digest, contact-form alert, test).
- For each: edit subject line, headline, and intro/closing copy. Branding, layout and data tables stay locked so emails keep the Midnight look.
- A variable palette per template ({{from}}, {{to}}, {{when}}, {{duration}}, {{transcript}}, ...) that inserts at the cursor and is validated on save.
- Live preview with sample data, "Send test to me", and reset-to-default. Overrides are stored in the database and used by every send path; templates without an override keep the built-in copy.

## 4. Per-user Gmail via OAuth

- Each signed-in user connects their own Google account from Settings and Tools > Mail, instead of everyone sharing one workspace mailbox.
- Scopes requested, shown before consent: userinfo.email, userinfo.profile, gmail.readonly (reading notification mail), gmail.send (sending replies). Nothing broader.
- Connect / Disconnect / Reconnect states with the connected Google address displayed. The Mail panel reads and sends as the signed-in user; users who have not connected see a connect prompt rather than someone else's inbox.
- This needs a workspace Google OAuth client for the Gmail app-user connector; I will open that setup card during the build.

## 5. Google Calendar sync settings

- New Calendar settings screen: choose which calendars are active, pick the default write calendar for bookings, and set the display timezone.
- Lookback and lookahead windows (e.g. 7 days back / 30 days forward) controlling what the Calendar panel and availability checks load.
- Event creation behaviour: title template, default duration, buffer, whether to invite the contact by email, whether to attach a Meet link, and whether AI-booked events are created as confirmed or tentative.
- Per-number booking settings keep working and inherit these defaults.

## Technical notes

- New tables: `saved_places`, `email_template_overrides`, `user_gmail_connections` (encrypted app-user connection key), `calendar_settings`; new columns on `email_log` for delivery/open/click timestamps and retry linkage. All with RLS scoped to the owning user plus admin read, and explicit grants.
- Places search moves behind a server function with a query-keyed cache; the panel debounces at ~250ms and aborts stale requests.
- Resend sends gain tags and tracking options; a new `/api/public/resend/webhook` route verifies the signing secret before applying status updates.
- Template rendering gains an override layer in `src/lib/email-templates`: defaults merged with stored copy, variables interpolated at render time.
- Gmail moves from the workspace `google_mail` App connector to the Gmail App User Connector: popup consent, one-time code exchanged server-side, connection key stored encrypted, all Gmail calls made server-side as the app user.
