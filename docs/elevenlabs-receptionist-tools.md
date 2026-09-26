# ElevenLabs receptionist tools

These webhook tools let the AI receptionist check real availability, reject out-of-area addresses, propose a booking, and save a lead. They are **not** applied to the live ElevenLabs account by deploy or by tests. The current key is shared with non-SixVox agents. An owner can press **Prepare booking tools** on the assistant screen. That call PATCHes the agent only when `SIXVOX_ELEVENLABS_DEDICATED=1` and the line has an agent id. Otherwise it returns the payload below and leaves ElevenLabs untouched.

Endpoints (all POST, JSON):

- `https://sixvox.3bi.io/api/public/elevenlabs/tool/check_availability`
- `https://sixvox.3bi.io/api/public/elevenlabs/tool/check_service_area`
- `https://sixvox.3bi.io/api/public/elevenlabs/tool/propose_booking`
- `https://sixvox.3bi.io/api/public/elevenlabs/tool/capture_lead`

Auth: header `x-sixvox-tool-secret` matching `ELEVENLABS_TOOL_SECRET` (or `ELEVENLABS_WEBHOOK_SECRET` / `TWILIO_WEBHOOK_TOKEN`). Post-call webhooks may instead send `ElevenLabs-Signature: t=<unix>,v0=<hex HMAC-SHA256 of t.rawBody>`.

Every tool body includes:

| Field           | Source                                                                             |
| --------------- | ---------------------------------------------------------------------------------- |
| `called_number` | `{{system__called_number}}`                                                        |
| `caller_number` | `{{system__caller_id}}`                                                            |
| `call_sid`      | `{{system__call_sid}}`                                                             |
| `utterance`     | the caller's latest words, used to detect Spanish when the line language is `auto` |

## check_availability

Lists open slots from Google Calendar. Travel time pads busy blocks. The buffer is the gap between offered slots. Never offer a time that is not in the result.

Extra field: `preferred_day` (optional ISO date).

## check_service_area

Geocodes `address` (required) and accepts it only inside the line's radius or ZIP list. Mode `off` skips the check. A missing geocode or ZIP is a rejection.

## propose_booking

Holds `slot_start` and `slot_end` (ISO, required) plus optional `address`, `customer_name`, `job_type`, and `summary`.

Default confirm mode is `confirm`: the tool proposes the slot, pushes the owner, and does not text the customer. The owner approves with one tap. Mode `automatic` is an owner opt-in: the calendar event is created and the confirmation text goes out immediately, through that line's Messaging Service, and only when the campaign is verified. Otherwise the result says the line is not registered for texting.

Booked slots (including travel padding) and out-of-area addresses are rejected.

## capture_lead

Saves name, callback number, service address, job type, and urgency onto the call. Address is validated with Google Maps when Maps is connected.

## Language

Line setting `phone_numbers.ai_language`: `en`, `es`, or `auto` (default `en`). Owners set it on the receptionist sheet and in line settings (Answering language). `auto` answers and books in Spanish when the caller speaks Spanish. Confirmation, cancel, and reschedule texts use the Spanish templates in `src/lib/answering/language.ts`. The proposal template is the same helper; the approval flow texts the customer when the owner approves (confirmed), not when the slot is first proposed.

Missed-call text-back uses the Spanish default only when the owner has not written their own text, and the line is `es` or (`auto` and the call transcript is already Spanish).

Saving the line also merges a `[sixvox-language]` block into that line's allowlisted ElevenLabs agent and sets the agent language to `es` for Spanish-only. Auto keeps the agent language `en` and tells it to switch. The patch is skipped when the line has no agent, ElevenLabs is not connected, or the agent is not in this workspace. Booking-tool attach still requires `SIXVOX_ELEVENLABS_DEDICATED=1` and is not part of this save. Marketing does not claim Spanish voice answering is fully shipped.

## After approval

The customer confirmation says to reply RESCHEDULE or CANCEL. Those replies are handled before carrier STOP keywords when an open proposal exists. Bare STOP still opts the customer out.
