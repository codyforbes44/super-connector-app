# Design review vs. the Beside screenshots

The reference app (Beside) is a flat near-black consumer messaging app with big type, pill controls and floating chrome. SixVox is a gradient "Midnight Dialer" surface with glass cards, cyan accents and a standard header + bottom tab bar. Below is what the reference does better, and the specific changes worth making.

## What the reference does better

1. **Floating chrome instead of edge-to-edge bars.** Beside's top row is two pill capsules (left: back/filter, right: search + settings) and its tab bar is a detached rounded pod with a separate round "+" FAB. SixVox uses a full-width sticky header with a small ghost icon and a full-width bottom bar. The pods read lighter and leave more content visible.
2. **Content-first list rows.** Beside leads with the phone number or contact name at ~20px bold, then a single grey status line ("Answered by Receptionist", "Missed Call for Cody") with a small colored source glyph, and a blue unread count on the right. SixVox rows carry more chrome (glass panel per row, avatar ring, badges) which costs vertical density.
3. **Status as plain language, not badges.** "Answered by Receptionist", "Missing Contact Information", "Callback needed" are sentences and one soft chip. SixVox uses multiple small badges (intent, sentiment, topics) which get noisy on a 375px screen.
4. **Grouped settings with colored icon tiles.** Beside groups settings into labelled sections (Calls / Text Messages / Emails / Your Account) where each row has a rounded-square colored tile — green for calls, blue for messaging, purple for email — plus a right-side value ("On", "Off", a count) and a chevron or overflow. This makes a long settings screen scannable at a glance. SixVox settings is a stack of cards with inline controls.
5. **Swipe actions on list rows.** Mark as read / Pin surfaced by swipe. SixVox has no row gestures.
6. **In-thread event cards.** A missed call or a receptionist answer renders as a card inside the conversation with the summary, "Tap to read transcript", and a waveform player with duration. SixVox keeps call intelligence in a separate call sheet.

## Recommended changes for SixVox

Keep the SixVox identity (cyan signal accent, Space Grotesk, gradient canvas) — adopt the _structure_, not the palette.

### Chrome

- Convert `ScreenHeader` to a floating pill layout on mobile: title capsule left, action capsule right, transparent background over the gradient.
- Convert the bottom tab bar into a detached rounded pod with safe-area margin, and add a single round primary FAB to its right for the screen's main action (new message on Inbox, dial on Calls).

### Lists (Inbox + Calls)

- Flatten rows: drop the per-row glass panel, use a hairline divider, name/number at `text-lg font-semibold`, one muted status line, unread pill right-aligned. Target ~72px rows.
- Add a small circular source glyph (AI receptionist / SMS / voicemail) in front of the status line instead of a badge row.
- Reduce to at most one soft chip per row ("Callback needed"), pushing the rest into detail.
- Add swipe-to-mark-read and swipe-to-pin on conversation rows.

### Settings

- Restructure `/settings` into labelled sections with colored rounded-square icon tiles and a right-side value + chevron pattern, matching the reference's scanability. Map: green = calls/number, cyan = messaging, violet = email/AI, amber = billing.

### Thread view

- Render missed calls and AI-answered calls as in-thread event cards with the one-line summary, a "Tap to read transcript" affordance and a compact waveform player — instead of only living in the Calls sheet.

### Contacts / quick actions

- The reference's "+" opens a sheet of verbs (Dial, New Chat, Ask assistant). Worth adopting for the FAB so one control covers every create action.

## Scope note

All of this is presentation-layer work in `AppShell.tsx`, the inbox/calls/settings routes, the thread view and `styles.css` utilities. No data model, server function or Twilio behaviour changes. The deactivation toast in the screenshots is the reference app's own notice and is ignored.

## Suggested order

1. Chrome (floating header + tab pod + FAB) — biggest perceived change, lowest risk.
2. Inbox and Calls row density.
3. Settings sectioning with icon tiles.
4. In-thread call event cards.
5. Swipe actions and FAB action sheet.
