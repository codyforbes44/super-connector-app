# SixVox as a real phone app, not a provider dashboard

Two changes running side by side: everything a normal user reads becomes plain-English phone-app language, and a new "use my own number" path lets someone keep their carrier line and forward unanswered calls into SixVox voicemail and the AI assistant.

## 1. Talk like a phone app

- Every user-facing label drops telecom/provider jargon. "Wire number" becomes "Turn on SixVox answering"; TwiML app, messaging service, webhooks and SIDs disappear from non-admin views; "Number account / balance / usage" becomes an admin-only "Account health" panel.
- Settings is reorganised for a normal person: My line, Voicemail & AI assistant, Alerts, Microphone, Contacts & calling, Billing.
- Advanced provider panels (API console, TwiML app, messaging services, webhook URLs, account usage) move into a single admin-only "Advanced" screen. Non-admins never see those links.
- Tabs stay Inbox / Calls / Numbers / Tools / Settings, with Numbers presented as "My line".
- Marketing pages, empty states, toasts and email copy get the same pass: benefits ("your second line answers when you can't"), never provider names.

## 2. Self-serve first, admin assists

- New signups keep full access. Anything not configured shows a friendly "Set this up" card instead of an error, and a dismissible setup checklist tracks: pick a line (or bring your own), turn on alerts, choose how calls are answered, add contacts.
- A "Request help from support" button on the checklist flags the account for an admin.
- Admin-only per-user account page: assign or buy a line, set outbound caller ID and default line, choose answering mode + AI voice + agent + greeting, set plan / comp / suspend / role, and see forwarding status with a manual "mark verified" control.

## 3. Bring your own number

- New flow under My line: "I already have a phone number." The user enters their existing mobile number and picks a forwarding style:
  - **Only when I can't answer** (busy / no answer / unreachable) — their phone rings normally, SixVox picks up the misses.
  - **Send every call to SixVox** — the assistant answers first.
- SixVox assigns them a dedicated line and shows step-by-step, copy-and-tap dial codes for their carrier (AT&T, Verizon, T-Mobile, US Cellular, Google Fi, plus a generic GSM fallback), each as a one-tap `tel:` link pre-filled with their SixVox number, with matching turn-off codes.
- "Check my forwarding": when SixVox sees an inbound call arrive on their assigned line, the setup flips to verified with a green status.
- Forwarded calls are answered exactly like a SixVox line — chosen greeting or AI receptionist, transcript, push and email alerts — and callbacks use their real number as caller ID once verified.
- Status card shows number, forwarding style, SixVox line, verification state, and a "Stop forwarding" panel with deactivation codes.

## Technical notes

**Data** (one migration)
- `byo_numbers`: `user_id`, `personal_number`, `carrier`, `forward_mode` (`conditional` | `all`), `assigned_number`, `status` (`pending` | `verified` | `off`), `verified_at`, `last_forwarded_call_at`, timestamps. RLS: owner read/write, admins full; GRANTs to `authenticated` and `service_role` in the same migration.
- `profiles`: add `setup_state jsonb` and `support_requested_at`.

**Server**
- `src/lib/byo.server.ts` + `byo.functions.ts` behind `requireSupabaseAuth`: save settings, poll verification, disable forwarding, admin overrides.
- Pure module `src/lib/forwarding-codes.ts` holds the carrier code table so the UI can render codes client-side.
- Inbound voice path (`voice-answer.server.ts`, `api/public/twilio/app-voice.ts`): when a call lands on a line with a `byo_numbers` row, stamp `last_forwarded_call_at`, flip `pending` to `verified`, and use that user's greeting/agent config. Existing ringback and fallback behaviour untouched.
- Admin per-user config reuses `twilio-ops.server.ts` and `elevenlabs-ops.server.ts` through an admin-acting-on-user variant guarded by `is_admin`.

**UI**
- `src/components/line/BringYourOwnNumber.tsx` (wizard: number → style → carrier → codes → verify) and `ForwardingStatusCard.tsx`.
- `src/routes/_authenticated/admin.$userId.tsx` account page; `subscribers.tsx` rows link into it.
- `src/routes/_authenticated/advanced.tsx` collecting API console, TwiML app, messaging services, webhook URLs and account usage, admin-gated.
- `SetupChecklist.tsx` on Inbox for accounts with incomplete setup.
- Copy pass across `numbers.tsx`, `settings.tsx`, `calls.tsx`, `tools.tsx`, `inbox/*`, `welcome.tsx`, marketing routes and email templates.

**Notes**
- Carrier codes are dialled by the user on their own handset; SixVox cannot set them programmatically, so verification is observational (first forwarded call) plus a manual admin override.
- Conditional forwarding usually needs three codes (busy, no answer, unreachable); the wizard walks them one at a time with a tick per code.