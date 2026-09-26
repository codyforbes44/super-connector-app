/**
 * ElevenLabs receptionist tool definitions.
 *
 * These are NOT applied to the live ElevenLabs account from this module.
 * The current API key is shared with non-SixVox agents. `attachReceptionistTools`
 * refuses to PATCH an agent unless SIXVOX_ELEVENLABS_DEDICATED=1, which is set
 * only after SixVox has its own key. Until then an owner can read the payload
 * here and in docs/elevenlabs-receptionist-tools.md.
 */

import { PUBLIC_BASE_URL } from "./app.server";

export const RECEPTIONIST_TOOL_NAMES = [
  "check_availability",
  "check_service_area",
  "propose_booking",
  "capture_lead",
] as const;

export type ReceptionistToolName = (typeof RECEPTIONIST_TOOL_NAMES)[number];

export const SPANISH_PROMPT_ADDENDUM = [
  "Detect the caller's language on the first turn.",
  "If they speak Spanish, continue the whole call in Spanish, including booking, the address check, and the goodbye.",
  "Use check_availability, check_service_area, propose_booking, and capture_lead.",
  "Never invent an open time. If propose_booking says the slot is booked or the address is outside the service area, say that and offer another option.",
  "The default is booking-by-confirmation: tell the caller the owner will confirm, then they get a text.",
  "Only say the job is booked when the tool result says booked.",
].join(" ");

export type WebhookTool = {
  type: "webhook";
  name: ReceptionistToolName;
  description: string;
  api_schema: {
    url: string;
    method: "POST";
    request_headers: Record<string, string>;
    request_body_schema: {
      type: "object";
      required?: string[];
      properties: Record<string, { type: string; description: string }>;
    };
  };
};

const sharedProperties = {
  called_number: {
    type: "string",
    description: "The SixVox number that was called. Pass {{system__called_number}}.",
  },
  caller_number: {
    type: "string",
    description: "The caller's number. Pass {{system__caller_id}}.",
  },
  call_sid: {
    type: "string",
    description: "Twilio call SID. Pass {{system__call_sid}}.",
  },
  utterance: {
    type: "string",
    description: "The caller's latest words, used to detect Spanish.",
  },
};

function tool(
  name: ReceptionistToolName,
  description: string,
  extra: WebhookTool["api_schema"]["request_body_schema"]["properties"],
  required: string[] = ["called_number"],
): WebhookTool {
  return {
    type: "webhook",
    name,
    description,
    api_schema: {
      url: `${PUBLIC_BASE_URL}/api/public/elevenlabs/tool/${name}`,
      method: "POST",
      request_headers: { "x-sixvox-tool-secret": "{{ELEVENLABS_TOOL_SECRET}}" },
      request_body_schema: {
        type: "object",
        required,
        properties: { ...sharedProperties, ...extra },
      },
    },
  };
}

export function receptionistTools(): WebhookTool[] {
  return [
    tool(
      "check_availability",
      "List open appointment slots from the business Google Calendar, including travel time and the gap between jobs. Never offer a time that is not in the result.",
      {
        preferred_day: { type: "string", description: "Optional ISO date the caller asked for." },
      },
    ),
    tool(
      "check_service_area",
      "Geocode a service address and accept it only when it is inside the line's radius or ZIP list.",
      { address: { type: "string", description: "Street address the caller gave." } },
      ["called_number", "address"],
    ),
    tool(
      "propose_booking",
      "Hold a slot. Unless the line opted into automatic booking, this only proposes the slot for the owner to approve. Reject booked slots and out-of-area addresses.",
      {
        slot_start: { type: "string", description: "ISO start from check_availability." },
        slot_end: { type: "string", description: "ISO end from check_availability." },
        address: { type: "string", description: "Service address." },
        customer_name: { type: "string", description: "Caller name." },
        job_type: { type: "string", description: "Kind of job, such as plumbing or HVAC." },
        summary: { type: "string", description: "Short job title for the calendar." },
      },
      ["called_number", "slot_start", "slot_end"],
    ),
    tool(
      "capture_lead",
      "Save the caller's name, callback number, service address, job type, and urgency.",
      {
        customer_name: { type: "string", description: "Caller name." },
        callback_number: { type: "string", description: "Best callback number." },
        address: { type: "string", description: "Service address." },
        job_type: { type: "string", description: "Kind of job." },
        urgency: { type: "string", description: "low, normal, or high." },
      },
      ["called_number"],
    ),
  ];
}

/** JSON body an owner-triggered attach would PATCH onto an agent. */
export function receptionistAgentPatch(language: string): {
  conversation_config: {
    agent: {
      language: string;
      prompt: { prompt: string; tools: WebhookTool[] };
    };
  };
} {
  const spanish = language === "es" || language === "auto";
  return {
    conversation_config: {
      agent: {
        language: language === "es" ? "es" : "en",
        prompt: {
          prompt: spanish
            ? SPANISH_PROMPT_ADDENDUM
            : "Use the booking tools. Never invent an open time.",
          tools: receptionistTools(),
        },
      },
    },
  };
}

export const SHARED_KEY_REASON =
  "The ElevenLabs key is shared with other agents. Tool changes stay in the repo until a SixVox-only key is set (SIXVOX_ELEVENLABS_DEDICATED=1). Nothing was created, modified, or deleted in ElevenLabs.";

export function elevenLabsDedicated(
  env: Record<string, string | undefined> = process.env,
): boolean {
  return env["SIXVOX_ELEVENLABS_DEDICATED"] === "1";
}
