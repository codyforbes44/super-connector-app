import type { SupabaseClient } from "@supabase/supabase-js";

import { PUBLIC_BASE_URL, webhookUrl } from "./app.server";
import {
  ELEVENLABS_TWILIO_INBOUND_URL,
  ensureAgentPhoneNumber,
  hasElevenLabs,
} from "./elevenlabs.server";
import { GREETING_BUCKET } from "./elevenlabs-ops.server";
import { AI_IDENTITY, RECORDING_CONSENT, composeAiFirstMessage } from "./compliance/recording-copy";

export { AI_IDENTITY, RECORDING_CONSENT, composeAiFirstMessage };

export function escapeXml(value: string): string {
  return value.replace(
    /[<>&'"]/g,
    (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", "'": "&apos;", '"': "&quot;" })[c] as string,
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

export function recordingNoticeTwiml(): string {
  return `<Say voice="alice">${escapeXml(RECORDING_CONSENT)}</Say>`;
}

/** Whisper played to the other party when they answer a recorded call. */
export function recordingNoticeResponseTwiml(): string {
  return recordingNoticeTwiml();
}

export function recordingNoticeWebhook(): string {
  return webhookUrl("recording-notice");
}

/**
 * Starts a call recording, then speaks the notice, so the recording file
 * begins with the notice. The other party hears the same notice from the
 * whisper URL on Number or Client.
 */
export function liveRecordingPrefix(): string {
  return `<Start><Recording channels="dual" recordingStatusCallback="${escapeXml(recordingCallbackUrl())}" recordingStatusCallbackEvent="completed" /></Start>${recordingNoticeTwiml()}`;
}

function partyNoticeUrl(record: boolean): string {
  if (!record) return "";
  return ` url="${escapeXml(recordingNoticeWebhook())}" method="POST"`;
}

/** Twilio posts finished recordings here; we transcribe them ourselves. */
export function recordingCallbackUrl(): string {
  return webhookUrl("recording");
}

/** `<Record>` verb used for voicemail — the notice is the verb immediately before it. */
export function recordVerb(): string {
  return `${recordingNoticeTwiml()}<Record maxLength="120" playBeep="true" recordingStatusCallback="${escapeXml(recordingCallbackUrl())}" recordingStatusCallbackEvent="completed" />`;
}

/**
 * Last-resort voicemail when the primary voice handler fails. The recording
 * notice is inside `recordVerb`, so it plays before Twilio starts recording.
 */
export function fallbackVoicemailTwiml(): string {
  return `<Say voice="alice">Thanks for calling. Please leave a message after the tone.</Say>${recordVerb()}<Say voice="alice">We did not receive a recording. Goodbye.</Say>`;
}

/** Twilio posts DialCallStatus here when a forwarded dial finishes. */
export function dialActionUrl(): string {
  return webhookUrl("dial-action");
}

/** Which inbound ring leg just finished, so dial-action can continue the chain. */
export type InboundRingLeg = "clients" | "owner_cell";

export function inboundRingActionUrl(leg: InboundRingLeg): string {
  const url = new URL(dialActionUrl());
  url.searchParams.set("leg", leg);
  return url.toString();
}

/**
 * Forwarded two-party dial. When recording is on, the file starts with the notice.
 * The dial action is what missed-call text-back listens to.
 */
export function forwardedCallTwiml(input: {
  record: boolean;
  callerId: string;
  destination: string;
  timeoutSeconds: number;
  actionUrl?: string;
}): string {
  const prefix = input.record ? liveRecordingPrefix() : "";
  const action = input.actionUrl ?? dialActionUrl();
  return `${prefix}<Dial action="${escapeXml(action)}" method="POST" callerId="${escapeXml(input.callerId)}" timeout="${input.timeoutSeconds}" ringTone="us"><Number${partyNoticeUrl(input.record)}>${escapeXml(input.destination)}</Number></Dial>`;
}

/** Outbound in-app dial. The app user hears the notice; the callee hears the whisper. */
export function outboundAppDialTwiml(input: {
  record: boolean;
  callerId: string;
  destination: string;
  actionUrl: string;
}): string {
  const prefix = input.record ? liveRecordingPrefix() : "";
  return `${prefix}<Dial callerId="${escapeXml(input.callerId)}" answerOnBridge="true" action="${escapeXml(input.actionUrl)}"><Number${partyNoticeUrl(input.record)}>${escapeXml(input.destination)}</Number></Dial>`;
}

/** Inbound ring to in-app clients. */
export function inboundClientDialTwiml(input: {
  record: boolean;
  callerId: string;
  timeoutSeconds: number;
  actionUrl: string;
  clientIdentities: string[];
}): string {
  const prefix = input.record ? liveRecordingPrefix() : "";
  const clients = input.clientIdentities
    .map((identity) => `<Client${partyNoticeUrl(input.record)}>${escapeXml(identity)}</Client>`)
    .join("");
  return `${prefix}<Dial callerId="${escapeXml(input.callerId)}" timeout="${input.timeoutSeconds}" ringTone="us" answerOnBridge="true" action="${escapeXml(input.actionUrl)}" method="POST">${clients}</Dial>`;
}

/** PSTN bridge used when the dialer calls the owner's cell first. */
export function bridgeCallTwiml(input: {
  record: boolean;
  callerId: string;
  destination: string;
}): string {
  const prefix = input.record
    ? liveRecordingPrefix()
    : `<Say voice="alice">Connecting your call.</Say>`;
  return `${prefix}<Dial callerId="${escapeXml(input.callerId)}"><Number${partyNoticeUrl(input.record)}>${escapeXml(input.destination)}</Number></Dial>`;
}

export function aiHandoffTwiml(input: { record: boolean; redirectUrl: string }): string {
  const redirect = `<Redirect method="POST">${escapeXml(input.redirectUrl)}</Redirect>`;
  const identity = `<Say voice="alice">${escapeXml(AI_IDENTITY)}</Say>`;
  if (!input.record) return `${identity}${redirect}`;
  return `${liveRecordingPrefix()}${identity}${redirect}`;
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
  record_calls?: boolean | null;
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
function fallbackTwiml(config: NumberVoiceConfig, classic: string, appNumber: string): string {
  if (config.ai_fallback === "hangup") {
    return `<Say voice="alice">Sorry, we can't take your call right now. Please try again later.</Say><Hangup />`;
  }
  if (config.ai_fallback === "forward" && config.ai_fallback_number) {
    return (
      forwardedCallTwiml({
        record: Boolean(config.record_calls),
        callerId: appNumber,
        destination: config.ai_fallback_number,
        timeoutSeconds: 25,
      }) + classic
    );
  }
  return classic;
}

/**
 * TwiML for a call that lands on voicemail: either an ElevenLabs conversational
 * agent, or a spoken greeting (ElevenLabs audio when rendered) plus a recording.
 * Every ElevenLabs failure degrades to the classic greeting — a call must never
 * drop because the AI layer is unavailable.
 */
/** Greeting plus a recording. Used for classic voicemail and after-hours voicemail. */
export async function classicVoicemailTwiml(
  admin: SupabaseClient,
  config: NumberVoiceConfig,
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

  return `${intro}${recordVerb()}<Say voice="alice">We did not receive a recording. Goodbye.</Say>`;
}

export async function voicemailTwiml(
  admin: SupabaseClient,
  config: NumberVoiceConfig,
  ctx: { callSid: string; from: string; appNumber: string },
): Promise<string> {
  const classic = await classicVoicemailTwiml(admin, config);

  // AI-voiced greeting: the rendered ElevenLabs audio (or a spoken fallback) then a recording.
  if (config.answer_mode === "ai_greeting") return classic;

  if (config.answer_mode === "ai_agent" && config.elevenlabs_agent_id && hasElevenLabs()) {
    try {
      // ElevenLabs answers the call itself, so the number must be registered
      // with them and bound to this agent. Re-verify on every call: a stale
      // cached id makes the hand-off return something Twilio can't read, which
      // the caller hears as a generic application error.
      const numberId = await ensureAgentPhoneNumber(ctx.appNumber, config.elevenlabs_agent_id);
      if (!numberId) return fallbackTwiml(config, classic, ctx.appNumber);
      if (numberId !== config.elevenlabs_phone_number_id) {
        await admin
          .from("phone_numbers")
          .update({ elevenlabs_phone_number_id: numberId })
          .eq("phone_number", ctx.appNumber);
      }
      return aiHandoffTwiml({
        record: Boolean(config.record_calls),
        redirectUrl: ELEVENLABS_TWILIO_INBOUND_URL,
      });
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
      return fallbackTwiml(config, classic, ctx.appNumber);
    }
  }

  return classic;
}
