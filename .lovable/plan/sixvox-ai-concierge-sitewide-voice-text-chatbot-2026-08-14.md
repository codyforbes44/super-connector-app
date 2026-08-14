# SixVox AI Concierge — sitewide voice + text chatbot

An ElevenLabs conversational agent ("Vox") lives on every page: a floating amber orb on the marketing site and inside the app. Visitors can talk to it or type. It knows the whole SixVox product, answers pricing questions from live data, captures leads, books callbacks, navigates the site, and hands off to a human. Signed-in users get account-aware answers.

## What gets built

**1. The agent itself (agent_2701kzz3f6aee48a38vw0qsehbks, voice rgIPBzZ4HG4IJ7HHjADN)**
Configured programmatically from the app so the prompt, tools, voice and first message are versioned in code, not hand-edited in a dashboard:
- Full system prompt: identity, tone (warm, direct, never pushy), SixVox product knowledge, pricing, competitor positioning vs Talkroute/Openphone-style tools, guardrails (never invent features/prices, never quote availability it can't verify, hand off on billing/account disputes).
- Knowledge base built from the real site content (features, how it works, pricing, FAQ, use cases, legal) plus a curated product FAQ, uploaded to the agent's knowledge base and re-synced with one admin action.
- Dynamic variables passed at session start: page the visitor is on, signed-in state, first name, plan, phone-number count, trial days left, timezone, referrer.
- First message adapts: anonymous visitor vs signed-in user vs pricing page.

**2. Tools the agent can actually call**
- `get_pricing` — live plans, prices and trial terms from the app's plan data.
- `capture_lead` — name, email, phone, need, urgency; saved and confirmed back to the visitor.
- `send_followup_email` — branded Resend email with a recap and next step.
- `book_callback` — requested time window, saved as a callback request; confirmation email to the visitor and a notification to the team.
- `navigate` — moves the visitor's browser to the right page (client-side tool).
- `start_signup` — sends them to signup/checkout for the plan discussed.
- `handoff_to_human` — flags the conversation, notifies the team by email, tells the visitor what to expect.
- Signed-in only: `get_my_account` (plan, numbers, trial, usage), `get_my_recent_activity` (recent calls/messages summary), `open_app_screen`.
Account tools verify the session server-side and refuse when the caller is anonymous.

**3. Transcripts, leads and the admin view**
- Every conversation is stored with turns, page context, duration, mode (voice/text), captured lead fields and outcome.
- Post-call webhook from ElevenLabs writes the final transcript, summary and evaluation results.
- Each conversation is auto-scored (intent, urgency, lead quality, was-it-answered) using the existing AI summariser.
- New admin screen: conversation list with filters, lead pipeline, transcript viewer, unanswered-question report so the knowledge base can be improved.

**4. Automations**
- New qualified lead → team notification email + optional SMS to the owner's SixVox number.
- Callback requested → team notification with the requested window.
- Handoff → immediate alert.
- Daily rollup of chatbot conversations folded into the existing digest.

## Technical notes

- `@elevenlabs/react` `useConversation` with WebRTC; a server route mints a conversation token so the API key never reaches the browser. Text-only mode uses the same agent with `textOnly`.
- Client tools (`navigate`, `open_app_screen`, `start_signup`) run in the browser; data tools are ElevenLabs server tools pointed at new `/api/public/agent/*` routes secured with a shared secret, plus session-scoped auth for account tools.
- Agent config, prompt, tool definitions and knowledge base sync live in `src/lib/agent/` and are applied through the existing ElevenLabs server layer (`elevenlabs.server.ts`) with an admin "Sync agent" action.
- New tables: `chat_conversations`, `chat_messages`, `chat_leads`, `chat_callbacks` — RLS-scoped (owner/admin read, service-role write), with grants.
- Post-call webhook at `/api/public/elevenlabs/agent-post-call`, signature-verified.
- Widget mounts once in the root route; graphite + amber styling, respects reduced motion, mic permission requested only on the voice button, keyboard accessible, hidden during active phone calls in-app.
