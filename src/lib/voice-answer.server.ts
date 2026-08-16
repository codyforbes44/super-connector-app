import type { SupabaseClient } from "@supabase/supabase-js";

import { PUBLIC_BASE_URL, webhookUrl } from "./app.server";
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

/** Four US ring cycles (~6s each) before anything answers the call. */
export const RING_SECONDS = 24;

/** One full US ring cadence: 2s of 440+480Hz tone, 4s of silence. */
export const RINGBACK_AUDIO_URL = `${PUBLIC_BASE_URL}/ringback.mp3`;
export const RINGBACK_CYCLE_SECONDS = 6;

/**
 * Audible ring-back for the caller. Dialing an unregistered client identity
 * does NOT ring — Twilio fails that leg instantly and moves on — so the ring
 * is played as real audio instead, which reliably lasts the full window.
 */
export function ringbackTwiml(seconds: number = RING_SECONDS): string {
  const loops = Math.max(1, Math.round(seconds / RINGBACK_CYCLE_SECONDS));
  return `<Play loop="${loops}">${escapeXml(RINGBACK_AUDIO_URL)}</Play>`;
}

/** Spoken notice played before a live call is recorded. Never silent. */
export const RECORDING_CONSENT =
  "This call may be recorded and transcribed for note taking.";

/** Twilio posts finished recordings here; we transcribe them ourselves. */
export function recordingCallbackUrl(): string {
  return webhookUrl("recording");
}

/** `<Record>` verb used for voicemail — modern transcription happens in our callback. */
export function recordVerb(): string {
  return `<Record maxLength="120" playBeep="true" recordingStatusCallback="${escapeXml(recordingCallbackUrl())}" recordingStatusCallbackEvent="completed" />`;
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

  const classic = `${intro}${recordVerb()}<Say voice="alice">We did not receive a recording. Goodbye.</Say>`;

  // AI-voiced greeting: the rendered ElevenLabs audio (or a spoken fallback) then a recording.
  if (config.answer_mode === "ai_greeting") return classic;

  if (config.answer_mode === "ai_agent" && config.elevenlabs_agent_id && hasElevenLabs()) {
    try {
      // ElevenLabs answers the call itself, so the number must be registered
      // with them and bound to this agent. Re-verify on every call: a stale
      // cached id makes the hand-off return something Twilio can't read, which
      // the caller hears as a generic application error.
      const numberId = await ensureAgentPhoneNumber(ctx.appNumber, config.elevenlabs_agent_id);
      if (!numberId) return fallbackTwiml(config, classic);
      if (numberId !== config.elevenlabs_phone_number_id) {
        await admin
          .from("phone_numbers")
          .update({ elevenlabs_phone_number_id: numberId })
          .eq("phone_number", ctx.appNumber);
      }
      return `<Redirect method="POST">${escapeXml(ELEVENLABS_TWILIO_INBOUND_URL)}</Redirect>`;
    } catch (error) {
      console.error(`ElevenLabs hand-off failed for ${ctx.appNumber}:`, error);
      try {
        const { logWebhookError } = await import("./webhook-errors.server");
        await logWebhookError(admin, {
          source: "elevenlabs",
          message: error instanceof Error ? error.message : String(error),
          callSid: ctx.callSid,
          appNumber: ctx.appNumber,
        });
      } catch {
        // logging must never break the call
      }
      return fallbackTwiml(config, classic);
    }
  }

  return classic;
}