# ElevenLabs AI voicemail assistants

Turn voicemail from a recorded message into a real conversation: each Twilio number can either speak a lifelike ElevenLabs greeting before recording, or hand the caller to an ElevenLabs conversational agent that answers questions, takes details and leaves you a transcript.

## What you get

**Per-number answering mode** (Numbers → number settings):

1. `Classic voicemail` — today's behaviour, but the greeting is spoken in a chosen ElevenLabs voice instead of Twilio's robotic one.
2. `AI assistant` — the caller is connected live to one of your ElevenLabs conversational agents. The agent talks, listens and handles the call; the conversation is logged against the call record.

**Voice picker** — pulls your ElevenLabs voice library, lets you preview any voice in-app, and saves the chosen voice per number.

**Agent picker** — lists the conversational agents on your ElevenLabs account so you can attach one to a number, plus a field to paste an agent ID directly.

**Greeting studio** — write the greeting text, hear it rendered in the selected voice, and save. Rendered audio is cached so calls answer instantly instead of waiting on synthesis.

**Call records** — AI-answered calls are marked as such, and the agent transcript and summary land on the call, visible in the call detail sheet on the Calls screen.

**Settings → ElevenLabs** — connection status, default voice, default agent, and a test button.

## Technical details

**Database migration**
- `phone_numbers`: add `answer_mode text not null default 'classic'` (`classic` | `ai_agent`), `elevenlabs_voice_id text`, `elevenlabs_agent_id text`, `greeting_audio_path text`.
- New `ai_conversations` table: `call_sid`, `app_number`, `agent_id`, `conversation_id`, `transcript jsonb`, `summary text`, timestamps. Reads follow the existing `can_see_number` rule; writes are service-role only. GRANTs and RLS in the same migration.
- New public storage bucket `voice-greetings` for cached greeting MP3s — Twilio must fetch them unauthenticated.

**Server layer**
- `src/lib/elevenlabs.server.ts` — direct `https://api.elevenlabs.io` calls using the existing `ELEVENLABS_API_KEY`: list voices, list conversational agents, synthesize speech (`eleven_multilingual_v2`, `mp3_44100_128`), and mint signed agent WebSocket URLs for private agents.
- `src/lib/elevenlabs.functions.ts` — server functions behind `requireSupabaseAuth`: `listVoices`, `listAgents`, `previewVoice` (returns a data URL), `saveNumberVoiceSettings`, `renderGreeting` (synthesizes, uploads to the bucket, stores the path), `elevenLabsStatus`.

**Call flow**
- `api/public/twilio/voice.ts` and the inbound branch of `api/public/twilio/app-voice.ts` read the number's `answer_mode` after the existing forward / no-answer logic:
  - `classic` → `<Play>` the cached greeting URL when present, falling back to today's `<Say>`, then the current `<Record>`.
  - `ai_agent` → `<Connect><Stream url="wss://api.elevenlabs.io/v1/convai/conversation?agent_id=…"/></Connect>`, using a server-fetched signed URL for private agents, with custom parameters carrying the caller number, Twilio number and CallSid so the agent has context.
  - Any ElevenLabs failure falls through to classic voicemail TwiML — a call never drops because of the AI layer.
- New `api/public/elevenlabs/post-call.ts` — verifies the ElevenLabs webhook HMAC, writes transcript and summary into `ai_conversations`, updates `calls.transcription`, and fires the existing push notification so you know the assistant handled a call.

**UI**
- `src/components/VoiceAssistant.tsx` — mode toggle, voice picker with inline preview player, agent picker, greeting textarea and render button; rendered inside the existing number settings sheet in `numbers.tsx`, in the Midnight Dialer glass style.
- Settings gains an ElevenLabs status row next to the Twilio one.
- The call detail sheet gains an "AI assistant" section showing agent, summary and transcript when present.

**Notes**
- The ElevenLabs post-call webhook secret gets saved once and pasted into the ElevenLabs dashboard; the endpoint is created first, then I request the secret.
- Agent conversations are billed by ElevenLabs per minute on top of Twilio's per-minute charge.