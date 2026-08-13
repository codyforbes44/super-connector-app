# Daily digest, transcriptions and connected mail — review and fixes

## What I found

**Daily digest — designed but never sent.**
The digest email template, the per-user "daily digest" toggle and the "digest instead of instant" preference all exist, but nothing ever builds or sends a digest: there is no scheduled job in the database and no digest send path in the app. Zero digest emails have ever been logged. Worse, choosing "digest" mode currently *suppresses* the instant emails and replaces them with nothing, so that user goes silent.

**Transcription — only two narrow paths work.**
- AI-answered calls: the receptionist's post-call webhook stores the full transcript and runs the AI summary. This path is sound.
- Voicemail: uses Twilio's legacy transcription (English-only, low accuracy) and lands as a single blob of text.
- The "transcribe my calls" toggle in Assistant settings saves to the profile but is not read anywhere — normal calls are never transcribed, and there is no consent announcement despite the setting implying one.
Currently there are 0 transcripts and 0 intelligence records stored, so the Insights and conversation search screens have nothing to show.

**Reading mail from the connected account — works, but boxed in.**
Per-user Gmail (your own Google account, read + send) is connected and functional inside Tools > Mail: search, open a thread, compose. Gaps: replying inside a thread isn't possible (compose always starts a new mail), mail isn't surfaced next to the matching contact or conversation, there's no unread indicator anywhere in the app, and an expired or revoked connection surfaces as a generic error rather than a "reconnect" prompt.

## What I propose to build

### 1. Make the daily digest real
- A scheduled job runs hourly and sends each user their digest at 8am in their own timezone, covering the last 24 hours: missed calls, unanswered texts, voicemails, AI-handled calls and their summaries, plus anything still awaiting a reply.
- Users in "digest" mode stop losing alerts: their instant emails are queued into the digest instead of dropped.
- Nothing to report means no email — no empty digests.
- "Send me a digest now" button in Email notification settings so you can see exactly what it looks like with real data.

### 2. Finish transcription
- Honour the "transcribe my calls" toggle: when it's on, calls play a short spoken consent announcement, record, and transcribe.
- Replace legacy Twilio transcription with modern speech-to-text through Lovable AI for both voicemail and recorded calls — better accuracy, punctuation, and speaker turns instead of a single blob.
- Every finished transcript automatically runs the existing AI analysis pass (summary, intent, sentiment, topics, action items), so Calls, Insights and search finally populate.
- Call detail gets a transcript view with speaker turns and a "re-run analysis" action; failures show a clear reason instead of an empty panel.

### 3. Round out connected mail
- Reply inside an open thread (quoted, correct recipients and subject) rather than only composing new mail.
- A mail section on a contact and on a conversation showing recent messages with that person's address, with reply in place.
- Unread count on the Mail tab, and a "Reconnect Google" prompt when the connection has expired or been revoked.

## Technical notes

- New table `digest_queue` (user, event type, payload, sent flag) plus `profiles.digest_hour`; owner-scoped RLS and grants in the same migration. `pg_cron` + `pg_net` hit a new `/api/public/digest/run` route hourly authenticated with the project key; the route resolves who is due in their timezone and calls the existing notify/sendEmail layer with the existing `dailyDigest` template.
- Transcription: `voice-answer.server.ts` gains a consent `<Say>` and `record` + `recordingStatusCallback` when `profiles.transcribe_calls` is on; a new `/api/public/twilio/recording` route fetches the recording with the Twilio credentials and posts it to Lovable AI `/v1/audio/transcriptions` (`openai/gpt-4o-transcribe`), then calls the existing `ingestCallTranscript` and analysis in `intelligence.server.ts`. Legacy `transcribe="true"` on `<Record>` is removed.
- Mail: extend `gmail-user.server.ts` with `replyToThread` (RFC822 with `In-Reply-To`/`References`) and an unread-count query; `integrations.functions.ts` gains matching server functions; `MailPanel` gets an inline reply box and is reused as a compact panel on contact and conversation views. `GmailNotConnected` and gateway 401s render the existing `GmailConnect` reconnect card.
- One AI pass per conversation, cached; credit exhaustion (402) and rate limits (429) surface as in-app messages.