# SixVox app rebuild — Graphite & Amber, feed-first, native parity

A full rebuild of every authenticated screen on a new design system and a shared screen framework, with native-app behavior throughout. Public marketing pages inherit the new tokens but keep their current structure.

## 1. New design system

Replaces the Midnight Dialer / glass-pill language.

- Palette: graphite base `#0B0B0C`, elevated surface `#1A1B1E`, amber primary `#FFB020`, warm neutral text `#E8E6E3`. Light mode derived from the same hues so the theme toggle stays real.
- Type: Sora for headings and numerics, Manrope for body and UI. Loaded via a `<link>` in the root route.
- Surfaces: flat opaque cards with hairline borders, one soft elevation shadow, 16px radius. No frosted glass, no neon glow.
- Density: 8pt spacing scale, 44px minimum tap targets, one motion register (fast, short, spring-free).
- All values become semantic tokens in `src/styles.css`; components use tokens only.

## 2. Shared screen framework

Every authenticated route is rebuilt on one set of primitives so all screens behave identically:

- `Screen` — safe-area padding, collapsing header, scroll restoration, pull-to-refresh.
- `ScreenHeader` — title, back affordance, up to two actions, optional search field.
- `Section`, `Row`, `ListGroup` — hairline-divided feed rows with leading icon/avatar, title, subtitle, trailing value or chevron.
- `Sheet` — bottom sheet replacing every dialog on mobile, with drag handle and snap points.
- `Empty`, `ErrorState`, `Skeleton` — one implementation each, used everywhere.
- `Field` — labeled inputs with inline validation and mobile keyboard hints (`inputMode`, `autoComplete`, `enterKeyHint`).

Navigation: feed-first single column, bottom tab bar (Inbox, Calls, Dialer, Tools, Settings) with a primary action button, and sheet-based detail on phones.

## 3. Screens rebuilt

All in one sweep, grouped by how they get used.

Daily drivers

- Inbox list: virtualized threads, unread state, swipe to archive/call, search, realtime updates.
- Conversation: sticky composer with attachments, day separators, delivery status, keyboard-safe layout, contact context header.
- Calls: segmented filters, grouped-by-day rows, one-tap call back, recording/transcript inline.
- Dialer + in-call: full-bleed dialer, haptics and DTMF kept, in-call screen with mute/speaker/keypad/hold and reliable call-persistence behavior preserved.
- Contacts: sectioned A-Z list, fast search, device import, detail sheet with call/text/mail actions.

Setup and config

- Numbers, receptionist, A2P, calling settings, tools, connectors: rebuilt as settings feeds with grouped rows, per-row status pills, and sheet-based editors instead of inline panels.
- Every long form becomes stepped or grouped, with saved-state feedback.

Account and admin

- Settings, billing, subscribers, console, insights, eSIM, welcome: same framework, tables become card lists on phones and return to tables at `md:`.

## 4. Data layer standardization

- Every read moves to a shared `queryOptions` factory; route loaders `ensureQueryData`, components `useSuspenseQuery`.
- Mutations get optimistic updates plus rollback and a single toast convention.
- Realtime subscriptions for messages and calls invalidate the right keys instead of polling.
- Consistent retry/backoff and an offline-aware error state.

## 5. Native parity

- Safe areas everywhere (notch, home bar, keyboard inset), haptics on primary actions, pull-to-refresh, swipe actions, swipe-back gesture, skeleton-first loading.
- Offline-first: cached query persistence so Inbox, Calls and Contacts render from cache on cold start; queued outbound messages flush when connectivity returns.
- Permission and install prompts tuned per platform (notifications, contacts, mic), each with a rationale screen before the system prompt.
- Manifest, icons, splash and shortcut metadata refreshed to the new brand colors; existing push service worker untouched.

## 6. Accessibility and quality

- Single `<main>` per page, labels on all icon buttons, visible focus rings, AA contrast checked in both themes, reduced-motion support.
- Unique head metadata per route.

## Technical notes

- No changes to Twilio, ElevenLabs, Stripe, Resend, Google or webhook logic; server functions and `/api/public/*` routes stay as they are. Server-side edits are limited to any new read/query shapes the UI needs.
- One migration only if offline queueing needs a persisted outbox; otherwise no schema changes.
- Work lands screen by screen so the app stays runnable throughout: tokens and framework first, then daily drivers, then setup, then account/admin, then the native-parity and a11y pass.
