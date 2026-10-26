# Set agent_9701m5tte67we5mtnccf6ggn302h as the AI assistant for +1 (580) 217-8444

## Steps

1. **Allow the agent.** SixVox only lets numbers use approved agents; today only the website concierge is approved. Add `agent_9701m5tte67we5mtnccf6ggn302h` to the built-in approved list (alongside the concierge).
2. **Assign it to the number.** Update +1 (580) 217-8444 so its AI assistant is this agent and its answering mode is "AI agent". Record the change in the Audit log.
3. **Confirm.** Read the number back and confirm the agent shows in Receptionist settings for that line. Existing ring-first behavior (app rings, then AI picks up) stays as is.

## Not changed

- No Twilio call/text settings, no other numbers, no edits to the agent's own prompt or voice in ElevenLabs, no publishing.

## Technical details

- `src/lib/elevenlabs.server.ts`: append the id to `DEFAULT_ALLOWED_AGENT_IDS` (env `ELEVENLABS_ALLOWED_AGENT_IDS`, if set, still overrides — will check and note).
- Data update on `phone_numbers` where `phone_number = '+15802178444'`: `elevenlabs_agent_id`, `answer_mode = 'ai_agent'`; insert `audit_log` row.
- Live calls use the new allowlist only after publishing.
