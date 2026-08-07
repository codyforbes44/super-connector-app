import type { SupabaseClient } from "@supabase/supabase-js";

import {
  ELEVENLABS_TWILIO_INBOUND_URL,
  ensureAgentPhoneNumber,
  hasElevenLabs,
} from "./elevenlabs.server";
import { GREETING_BUCKET } from "./elevenlabs-ops.server";

export function escapeXml(value: string): string {
  return value.replace(
    /[<>&'"]/g,
    (c) =>
      ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", "'": "&apos;", '"': "&quot;" })[c] as string,
  );
}

export type NumberVoiceConfig = {
  answer_mode?: string | null;
  elevenlabs_agent_id?: string | null;
  elevenlabs_phone_number_id?: string | null;
  greeting_audio_path?: string | null;
  voicemail_greeting?: string | null;
  ai_prompt?: string | null;
  ai_first_message?: string | null;
  ai_tone?: string | null;
  ai_language?: string | null;
  ai_fallback?: string | null;
  ai_fallback_number?: string | null;
  ai_max_duration?: number | null;
};

/** Columns every caller must select for voicemail/AI answering to behave. */
export const VOICE_CONFIG_COLUMNS =
  "voicemail_greeting, answer_mode, elevenlabs_agent_id, elevenlabs_phone_number_id, greeting_audio_path, ai_prompt, ai_first_message, ai_tone, ai_language, ai_fallback, ai_fallback_number, ai_max_duration";

export const AI_TONES: Record<string, string> = {
  professional: "Speak in a polished, professional and efficient tone.",
  friendly: "Speak in a warm, friendly and upbeat tone.",
  concise: "Speak in a brief, direct tone. Keep every reply to one or two sentences.",
  empathetic: "Speak in a calm, empathetic and reassuring tone.",
  playful: "Speak in a light, playful and casual tone while staying helpful.",
};

/** What happens when the AI assistant cannot take the call. */
function fallbackTwiml(config: NumberVoiceConfig, classic: string): string {
  if (config.ai_fallback === "hangup") {
    return `<Say voice="alice">Sorry, we can't take your call right now. Please try again later.</Say><Hangup />`;
  }
  if (config.ai_fallback === "forward" && config.ai_fallback_number) {
    return `<Dial timeout="25"><Number>${escapeXml(config.ai_fallback_number)}</Number></Dial>${classic}`;
  }
  return classic;
}

/**
 * TwiML for a call that lands on voicemail: either an ElevenLabs conversational
 * agent, or a spoken greeting (ElevenLabs audio when rendered) plus a recording.
 * Every ElevenLabs failure degrades to the classic greeting — a call must never
 * drop because the AI layer is unavailable.
 */
export async function voicemailTwiml(
  admin: SupabaseClient,
  config: NumberVoiceConfig,
  ctx: { callSid: string; from: string; appNumber: string },
): Promise<string> {
  const greeting =
    config.voicemail_greeting || "Thanks for calling. Please leave a message after the tone.";

  let intro = `<Say voice="alice">${escapeXml(greeting)}</Say>`;
  if (config.greeting_audio_path) {
    try {
      const { data } = await admin.storage
        .from(GREETING_BUCKET)
        .createSignedUrl(config.greeting_audio_path, 3600);
      if (data?.signedUrl) intro = `<Play>${escapeXml(data.signedUrl)}</Play>`;
    } catch {
      // keep the spoken fallback
    }
  }

  const classic = `${intro}<Record maxLength="120" playBeep="true" transcribe="true" /><Say voice="alice">We did not receive a recording. Goodbye.</Say>`;

  // AI-voiced greeting: the rendered ElevenLabs audio (or a spoken fallback) then a recording.
  if (config.answer_mode === "ai_greeting") return classic;

  if (config.answer_mode === "ai_agent" && config.elevenlabs_agent_id && hasElevenLabs()) {
    try {
      // ElevenLabs answers the call itself, so the number must be registered
      // with them and bound to this agent. Cache the id to skip the round trip.
      let numberId = config.elevenlabs_phone_number_id ?? null;
      if (!numberId) {
        numberId = await ensureAgentPhoneNumber(ctx.appNumber, config.elevenlabs_agent_id);
        if (numberId) {
          await admin
            .from("phone_numbers")
            .update({ elevenlabs_phone_number_id: numberId })
            .eq("phone_number", ctx.appNumber);
        }
      }
      if (!numberId) return fallbackTwiml(config, classic);
      return `<Redirect method="POST">${escapeXml(ELEVENLABS_TWILIO_INBOUND_URL)}</Redirect>`;
    } catch {
      return fallbackTwiml(config, classic);
    }
  }

  return classic;
}