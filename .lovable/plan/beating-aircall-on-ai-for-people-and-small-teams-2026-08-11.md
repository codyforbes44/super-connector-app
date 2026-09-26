# Beating Aircall on AI, for people and small teams

Aircall sells a team phone system: shared inbox, CRM sync, live coaching, AI agents, 250+ integrations, a public API and an embeddable SDK. Their weakness is that all of it is shaped and priced for contact-center teams — seats, admin setup, sales calls.

SixVox wins by delivering the same AI depth to one person or a five-person shop, with zero telecom setup, on a phone rather than a desktop workspace. This phase focuses on AI depth.

## What SixVox already has

Numbers, calling, SMS/MMS, voicemail with transcription, an ElevenLabs AI receptionist with per-number answer modes, contacts, bring-your-own-number forwarding, push alerts, Gmail/Calendar/Maps tools, billing, and travel eSIMs.

## The gap versus Aircall

Aircall's AI does four things SixVox doesn't yet:

1. Transcribes and analyses every conversation, not just voicemail.
2. Produces a summary, sentiment, topics and action items per conversation.
3. Does the follow-up work automatically — notes, tasks, drafted replies.
4. Lets the AI agent take real actions mid-call instead of only taking a message.

## Phase 1 — Every conversation becomes searchable intelligence

- Live calls stay unrecorded by default. Intelligence is built from what can be captured honestly: the transcript of AI-answered calls, voicemail transcription, and an optional per-user "transcribe my calls" setting that is off by default and plays a spoken consent announcement before the call connects.
- Each finished conversation gets one AI pass producing: a one-line summary, caller intent, sentiment, key topics, and extracted details (names, addresses, dates, quoted prices, callback numbers).
- Calls and Inbox rows show that summary line instead of a bare timestamp. Tap through for the full transcript with speaker turns, and jump-to-moment playback wherever a recording legitimately exists.
- Search across transcripts, summaries and messages: "the plumber who quoted 400".

## Phase 2 — The assistant does the follow-up

- After every call, suggested actions appear as one-tap cards: add contact, save the address, create a calendar event, send a reply, set a callback reminder.
- Draft replies for missed calls and unanswered texts, editable before sending.
- Daily digest push and email: who called, what they wanted, what still needs a reply.
- Per-contact conversation memory: when the same number rings again, the incoming-call screen shows a context card with what happened last time — Aircall's Insight Cards, automatic and without a CRM.

## Phase 3 — An AI agent that resolves, not just records

- Upgrade the receptionist from message-taker to resolver, driven by a plain-English instruction sheet ("book appointments Tue–Thu 9–4, quote $150 minimum, escalate anything urgent to my cell").
- Give the agent real tools: check the user's calendar and book, look up an address, send a confirmation SMS or email, capture a callback number, screen spam.
- Warm escalation: the agent can ring the user mid-call with a spoken one-line brief ("Sarah, about a Thursday install") before connecting them.
- Per-caller rules: VIPs always ring through, known spam is declined silently, unknown numbers get screened first.

## Phase 4 — Insight sized for one person

- A weekly view: answered vs missed, response time, busiest hours, common caller intents, how many calls the AI handled end to end and how many escalated.
- Actionable nudges rather than a dashboard: "you missed 6 calls after 6pm last week — turn the receptionist on for evenings?"

## Positioning

- Public site reframes SixVox against team phone systems: same AI, no seat minimums, no onboarding call, keep the number you already have, live calls never recorded.
- New comparison page and a dedicated AI receptionist feature page, each with its own metadata.

## Technical notes

**Data (one migration)**

- `call_intelligence`: `call_id`, `user_id`, `summary`, `intent`, `sentiment`, `topics text[]`, `entities jsonb`, `action_items jsonb`, `model`, `created_at`.
- `call_transcripts`: `call_id`, `user_id`, `turns jsonb` (speaker, text, ms offset), `source` (`elevenlabs` | `stt` | `voicemail`).
- `contact_memory`: `contact_id`, `user_id`, `rolling_summary`, `last_call_at`.
- `caller_rules`: `user_id`, `number`, `behavior` (`vip` | `screen` | `block`).
- `profiles`: add `transcribe_calls boolean default false`, `assistant_instructions text`, `digest_enabled boolean`.
- Owner-scoped RLS on every new table, with GRANTs to `authenticated` and `service_role` in the same migration. Full-text index over summaries and transcript text for search.

**Server**

- `src/lib/intelligence.server.ts` — post-call pipeline: transcript in (ElevenLabs post-call webhook already lands at `api/public/elevenlabs/post-call`; voicemail through Lovable AI `/v1/audio/transcriptions` with `openai/gpt-4o-transcribe`), then one structured Lovable AI call (`openai/gpt-5.6-sol` on the Responses API) producing summary, intent, sentiment, topics, entities and actions.
- `intelligence.functions.ts` behind `requireSupabaseAuth` for reads, search, executing a suggested action and re-analysis.
- Follow-up actions reuse the existing `gcal.server.ts`, `gmail.server.ts`, `maps.server.ts` and `twilio-ops.server.ts` helpers — the AI proposes, the user taps, the existing server function performs.
- Agent tools exposed to ElevenLabs as signature-verified server-tool webhooks under `src/routes/api/public/elevenlabs/tools/*`, scoped to the number's owner.
- Consent: when `transcribe_calls` is on, the TwiML plays a short announcement before `<Dial>` and only then enables recording — never silently.

**UI**

- `src/components/intelligence/`: `CallSummaryCard`, `TranscriptView`, `ActionSuggestions`.
- Summary lines on Calls and Inbox rows; caller context card on the incoming-call screen.
- `src/routes/_authenticated/insights.tsx` for the weekly view; assistant instruction sheet inside `receptionist.tsx`; caller rules in `settings.tsx`.
- New marketing routes for the comparison page and the AI receptionist page.

**Cost control**

- One AI pass per conversation, cached, re-run only on demand; digests batched. Credit exhaustion (402) and rate limits (429) surface as clear in-app messages rather than silent failures.
