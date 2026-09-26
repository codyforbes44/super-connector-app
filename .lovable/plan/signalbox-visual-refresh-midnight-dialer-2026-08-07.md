# Signalbox visual refresh — "Midnight Dialer"

Restyle the whole app in the language of the reference: a deep blue-to-teal gradient canvas, glossy raised circular controls, soft-glow avatars, a bright green "call" action and a bright red "end call" action.

## The look

- **Canvas**: dark navy graduating to a deep teal at the bottom of every screen, so the app reads as one continuous surface instead of flat grey panels.
- **Accent**: electric blue becomes the primary accent (replacing the current amber), green reserved for call/connect/success, red for hang up/destructive.
- **Controls**: circular, slightly raised "pill" buttons with a soft inner highlight and outer shadow — the keypad-key feel from the reference.
- **Cards & rows**: translucent blue-tinted glass panels with generous rounding and a subtle top highlight edge.
- **Avatars**: circular with a thin glowing ring (green for active/WhatsApp, blue for standard).
- **Type**: keep Space Grotesk headings / DM Sans body; timers, durations and phone numbers get the large tabular treatment of the `03:34` in the reference.

## Screens

1. **Global shell** — gradient background, frosted bottom tab bar with a raised active pill and a glow under the selected icon; headers become translucent over the gradient.
2. **Landing (`/`)** — gradient hero with glow orbs, glass feature cards, green primary CTA.
3. **Auth (`/auth`)** — centered glass card on the gradient, circular brand mark, restyled inputs and buttons.
4. **Inbox list & thread** — glass conversation rows, ringed avatars, blue unread badges; bubbles become gradient blue (outbound) vs. glass (inbound); the composer becomes a floating rounded bar with a circular send button.
5. **Calls** — the biggest change: a proper **dialer** styled like the reference, with a 3x4 grid of raised circular keys (digit plus letters underneath), the dialed number shown large above it, and a big green call button. Call history rows get circular direction icons; the recording sheet gets the in-call treatment — large avatar card, timer, circular action buttons, red close.
6. **Numbers, Tools, Settings, Console** — the same glass cards, circular icon buttons and restyled inputs/selects/sheets so nothing looks left behind.

## Technical notes

- Add tokens to `src/styles.css`: new primary/success/destructive oklch values, `--gradient-app`, `--gradient-call`, glass surface and raised-key shadow variables, plus `@utility` helpers (`glass-panel`, `key-raised`, `app-gradient`, `ring-glow`).
- No behaviour, data or server-function changes — presentation only. The dialer keypad writes into the existing `to` state and reuses the existing `startCall` action.
- Restyle in place across `AppShell.tsx`, `ComposeSheet.tsx`, `PushNotifications.tsx`, `index.tsx`, `auth.tsx` and the five `_authenticated` routes; shadcn primitives are adjusted via classes/variants rather than rewritten.
