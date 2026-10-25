# iMessage (and RCS) via Claw Messenger

## Important first
- The setup steps you pasted are written for desktop AI agents (OpenClaw / Hermes). SixVox isn't one of those, so we won't install that plugin. We'll connect to Claw Messenger's service straight from SixVox instead.
- Your Claw Messenger key was pasted into chat. Please make a new key at clawmessenger.com and use that one. I'll ask for it in a secure form; it won't go in the code.

## What you'll get
- **Choose the channel per conversation:** iMessage, RCS or SMS. If iMessage doesn't work for a contact, SixVox falls back to SMS through your Twilio number.
- **One inbox:** iMessage replies land in the same Texting thread as SMS, with a small badge showing the channel ("iMessage", "RCS", "SMS").
- **Allowed contacts:** Claw Messenger only accepts incoming messages from numbers you've registered. Contacts get an "Allow iMessage replies" toggle that registers their number for you.
- **Status card:** Integrations gets a Claw Messenger card showing connected or not, plus a one-time test message to your phone. Setup counts as finished only after your reply shows up in SixVox.
- **Platform admin:** the Health tab shows Claw Messenger errors, and only super admins can connect or disconnect it.

## Steps
1. Check Claw Messenger's API: how to send messages, whether it can call SixVox when a message comes in (a webhook), and how to register a number. If incoming messages only work over a connection that stays open, I'll stop and check with you before going further, because the live site can't keep one open.
2. Ask for your new key in a secure form.
3. Build sending, receiving, contact registration, channel badges and the status card.
4. Send one test to 580-217-8444. Setup is done only after your reply shows up in the inbox.

## Technical details
- Secret `CLAW_MESSENGER_API_KEY`. Server-only client in `src/lib/claw-messenger.server.ts` (REST over fetch, workerd-safe).
- Inbound: `src/routes/api/public/claw/inbound.ts`, which checks a shared signing secret or token before accepting anything. Messages are matched to a workspace by the recipient/owner mapping; unmatched messages go to `webhook_errors` with a null workspace.
- Migration: add `channel` (`sms` | `imessage` | `rcs`) to messages, default `sms`; add `claw_route_registered` to contacts. Includes RLS and grants.
- Outbound picker in the thread composer; fall back to Twilio SMS if a Claw send fails.
- Tests cover the channel-fallback rule and the inbound sender allowlist.
- Nothing published, and no Twilio number settings changed.
