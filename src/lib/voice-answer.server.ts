import type { SupabaseClient } from "@supabase/supabase-js";

import { agentStreamUrl, hasElevenLabs } from "./elevenlabs.server";
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
  "voicemail_greeting, answer_mode, elevenlabs_agent_id, greeting_audio_path, ai_prompt, ai_first_message, ai_tone, ai_language, ai_fallback, ai_fallback_number, ai_max_duration";

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
  if (config.answer_mode === "ai_agent") return fallbackTwiml(config, classic);

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
      const streamUrl = await agentStreamUrl(config.elevenlabs_agent_id);
      const tone = AI_TONES[config.ai_tone ?? "professional"] ?? "";
      const prompt = [config.ai_prompt?.trim(), tone].filter(Boolean).join("\n\n");
      const entries: Array<[string, string]> = [
        ["caller_number", ctx.from],
        ["called_number", ctx.appNumber],
        ["call_sid", ctx.callSid],
        ["language", config.ai_language || "en"],
        ["tone", config.ai_tone || "professional"],
      ];
      if (prompt) entries.push(["prompt", prompt]);
      if (config.ai_first_message?.trim())
        entries.push(["first_message", config.ai_first_message.trim()]);
      const params = entries
        .map(
          ([name, value]) =>
            `<Parameter name="${escapeXml(name)}" value="${escapeXml(value ?? "")}" />`,
        )
        .join("");
      const limit = Math.min(Math.max(config.ai_max_duration ?? 300, 30), 3600);
      return `<Connect><Stream url="${escapeXml(streamUrl)}">${params}</Stream></Connect><Pause length="${limit}" />`;
    } catch {
      return fallbackTwiml(config, classic);
    }
  }

  return classic;
}