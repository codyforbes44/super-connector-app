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
};

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
  if (config.answer_mode === "ai_agent" && config.elevenlabs_agent_id && hasElevenLabs()) {
    try {
      const streamUrl = await agentStreamUrl(config.elevenlabs_agent_id);
      const params = [
        ["caller_number", ctx.from],
        ["called_number", ctx.appNumber],
        ["call_sid", ctx.callSid],
      ]
        .map(
          ([name, value]) =>
            `<Parameter name="${escapeXml(name!)}" value="${escapeXml(value ?? "")}" />`,
        )
        .join("");
      return `<Connect><Stream url="${escapeXml(streamUrl)}">${params}</Stream></Connect>`;
    } catch {
      // fall through to classic voicemail
    }
  }

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

  return `${intro}<Record maxLength="120" playBeep="true" transcribe="true" /><Say voice="alice">We did not receive a recording. Goodbye.</Say>`;
}