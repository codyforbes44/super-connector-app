# SixVox full app refresh — Slate & Electric Blue, split-screen, mobile first

A sweep across every page: a new visual language, one consistent screen framework, and real layouts for phone, tablet and desktop. The signed-in app comes first, then the public site inherits the same look. No changes to calling, texting, billing or any connected service behaviour — with one exception, the silent-ring fix below.

## 1. New look

Locked choices, applied everywhere:

- Colors: slate base `#0C1017`, raised surface `#182029`, electric blue `#3B82F6` for actions, light text `#E6ECF5`. A matching light theme derived from the same hues so the public site stays bright and the app can offer both.
- Type: Outfit for headings and numbers, Figtree for everything else, loaded from the font service in the page head.
- Surfaces: flat cards, hairline borders, one soft shadow, 16px corners. No glass, no glow.
- Spacing on an 8pt rhythm, 44px minimum tap targets, one quick motion register.
- Every value becomes a named token so light/dark and future tweaks are one place.

## 2. One screen framework, used by every page

The shared pieces already exist (screen body, sections, list rows, empty/error/loading, paging, fields). This pass makes every authenticated page actually use them, so all screens look and behave the same:

- Consistent page headers with title, back, up to two actions and optional search.
- Grouped rows with leading icon tile, title, one plain-English subtitle, trailing value or chevron.
- One loading skeleton, one empty state, one error state with retry, one "load more".
- Bottom sheets instead of dialogs on phones.
- Forms with correct mobile keyboards, inline validation and saved-state feedback.

## 3. Device layouts

- Phone: single column feed, bottom tab bar, floating primary action, safe areas at top, bottom and around the keyboard, swipe actions on list rows.
- Tablet and desktop: split screen. Left rail for navigation, list on the left pane, detail on the right — for Inbox, Calls, Contacts, Numbers and Receptionist. Selecting a row fills the right pane instead of navigating away; the phone keeps full-page navigation.
- Wide tables (subscribers, console, billing history) stay tables on desktop and become card lists on phones.
- Every screen checked at 375, 430, 768, 1024 and 1440 wide.

## 4. Pages covered

Signed-in: Inbox and conversation, Calls, Dialer and in-call, Contacts, Numbers, Receptionist, A2P, Tools and connectors, Insights, eSIM, Settings, Advanced, Billing, Subscribers, Console, Welcome.

Public: Home, Features, How it works, Use cases, Pricing, FAQ, Contact, Legal — same tokens and type, structure kept, spacing and mobile fit tightened, hero and cards restyled to the new palette.

## 5. Robustness

- Each page gets proper loading, empty and failure states — no blank screens, no endless spinners, no invented AI text.
- Reads go through the shared query setup so pages restore instantly from cache and refresh in the background.
- Actions get optimistic feedback and a single toast style.
- Accessibility: labels on icon buttons, visible focus rings, AA contrast in both themes, reduced-motion respected.
- Each page keeps its own title and preview text for sharing and search.

## 6. Silent ring fix

The one behaviour fix in this pass: an incoming call currently starts the ringtone from two places at once, and the newer guard can cancel the first attempt, so the call screen can appear with no sound. The ringtone will become idempotent per call — a second start for the same call is a no-op instead of cancelling the first — and the fallback tone only plays when nothing is already ringing.

## Technical notes

- Tokens defined in `src/styles.css`; fonts via `<link>` in `src/routes/__root.tsx`.
- Primitives live in `src/components/screen.tsx` and `src/components/AppShell.tsx`; a new two-pane layout primitive drives the split-screen behaviour on `md:` and up.
- Reads standardise on `queryOptions` + loader `ensureQueryData` + `useSuspenseQuery`.
- No server function, Twilio, ElevenLabs, Stripe, Resend or webhook changes. No DID mutations; the Concierge line stays untouched. No schema changes.
- Ringtone fix is confined to `src/lib/ringtone.ts` (plus its two callers if needed).
- Nothing is published.

## Order of work

1. Tokens, fonts, theme.
2. Shell, navigation, split-screen primitive.
3. Daily drivers: Inbox, Calls, Dialer, Contacts.
4. Setup screens: Numbers, Receptionist, A2P, Tools, Connectors.
5. Account and admin: Settings, Billing, Subscribers, Console, Insights, eSIM, Welcome.
6. Public site restyle.
7. Ringtone fix, accessibility and device pass at all five widths.
