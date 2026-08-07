# AI Receptionist: voices, agents and voicemail modes

Today, voice and agent assignment is buried in a small card on the Numbers page, agents can only be picked (never created or edited), and each number can only be "classic voicemail" or "AI agent". This plan adds a dedicated hub, in-app agent management, and a third answering mode.

## 1. New AI Receptionist hub (`/receptionist`)

A single mobile-first page with three tabs, linked from the bottom nav area, Settings and Connectors:

- **Voices** — the full ElevenLabs voice library with search and label filters (gender, accent, use case). Each voice row plays an instant sample, and can be set as the workspace default or applied to a specific number.
- **Agents** — every conversational agent on the account, with its voice, language and first message. Create a new agent, rename, edit its prompt / first message / voice / language, and delete. A "Duplicate" action makes variants quickly.
- **Numbers** — one row per SignalBox number showing its current answering mode, voice and agent, with inline assignment so an admin can wire up every number from one screen.

Account status (connected, tier, character usage) sits at the top so quota problems are obvious before a call fails.

## 2. Three answering modes per number

Each number picks one:

| Mode | What the caller hears |
| --- | --- |
| AI receptionist | The agent holds a real conversation, then a summary + transcript lands on the call record |
| AI-voiced greeting | The chosen ElevenLabs voice reads the greeting, then a normal recording is taken |
| Classic voicemail | Standard spoken greeting plus recording (no AI) |

The mode selector, voice picker and agent picker appear both in the hub's Numbers tab and at the top of the existing per-number Assistant screen, so prompt, tone, fallback, voice and agent all live together.

## 3. Agent creation flow

"New agent" opens a guided sheet: name → purpose preset (receptionist / lead intake / support triage) → prompt → first message → voice (with preview) → language. On save the agent is created on ElevenLabs and can be assigned to a number immediately. Editing an existing agent uses the same sheet pre-filled.

---

## Technical notes

- **Migration**: allow `answer_mode = 'ai_greeting'` (column is free-text `text` today, so this is only a default/validation update plus a backfill guard). No new tables — voice and agent ids already exist on `phone_numbers`.
- **`src/lib/elevenlabs.server.ts`**: add `getAgent`, `createAgent`, `updateAgent`, `deleteAgent` against `/v1/convai/agents` (`create`, `GET/PATCH/DELETE /v1/convai/agents/:id`), and extend `listAgents` to return voice id, language and first message. Keep the existing error-surfacing style (status + body).
- **`src/lib/elevenlabs-ops.server.ts`**: `requireAdmin` + `audit` wrappers for the new agent CRUD; extend `saveAssistant` to accept the third mode and to render the greeting audio when `ai_greeting` is chosen.
- **`src/lib/elevenlabs.functions.ts`**: new `createAgent`, `updateAgent`, `deleteAgent`, `getAgent` server fns using `requireSupabaseAuth`.
- **`src/lib/voice-answer.server.ts`**: `voicemailTwiml` gains an `ai_greeting` branch — play the rendered ElevenLabs audio (falling back to `<Say>` if storage or synthesis fails), then `<Record>`. Existing `ai_agent` and classic paths are unchanged.
- **UI**: new `src/routes/_authenticated/receptionist.tsx` with `src/components/receptionist/VoiceLibrary.tsx`, `AgentList.tsx`, `AgentEditorSheet.tsx`, `NumberAssignments.tsx`. The existing `VoiceAssistant` card on Numbers is slimmed to a status summary that links into the hub; `assistant.$sid.tsx` gains a mode/voice/agent section at the top.
- Everything stays on the Midnight Dialer glass-panel styling with route-level `head()` metadata.
