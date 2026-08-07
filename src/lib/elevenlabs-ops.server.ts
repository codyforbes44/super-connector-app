import type { SupabaseClient } from "@supabase/supabase-js";

import { allowedNumbers, audit, requireAdmin } from "./app.server";
import * as el from "./elevenlabs.server";

export const GREETING_BUCKET = "voice-greetings";

function bytesToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.length; i += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(binary);
}

export async function status(supabase: SupabaseClient, userId: string) {
  await requireAdmin(supabase, userId);
  return el.accountStatus();
}

export async function voices(supabase: SupabaseClient, userId: string) {
  await allowedNumbers(supabase, userId);
  return el.listVoices();
}

export async function agents(supabase: SupabaseClient, userId: string) {
  await allowedNumbers(supabase, userId);
  return el.listAgents();
}

/** Short spoken sample returned as a data URL for immediate playback. */
export async function preview(
  supabase: SupabaseClient,
  userId: string,
  args: { voiceId: string; text?: string },
) {
  await allowedNumbers(supabase, userId);
  const audio = await el.synthesize({
    voiceId: args.voiceId,
    text: (args.text || "Hi, thanks for calling. Leave a message and we'll be right back.").slice(
      0,
      400,
    ),
  });
  return { dataUrl: `data:audio/mpeg;base64,${bytesToBase64(audio)}` };
}

export async function saveAssistant(
  supabase: SupabaseClient,
  userId: string,
  args: {
    sid: string;
    answerMode: "classic" | "ai_agent";
    voiceId: string | null;
    agentId: string | null;
  },
) {
  await requireAdmin(supabase, userId);
  if (args.answerMode === "ai_agent" && !args.agentId) {
    throw new Error("Pick an ElevenLabs agent before switching to the AI assistant.");
  }
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { error } = await supabaseAdmin
    .from("phone_numbers")
    .update({
      answer_mode: args.answerMode,
      elevenlabs_voice_id: args.voiceId,
      elevenlabs_agent_id: args.agentId,
    })
    .eq("sid", args.sid);
  if (error) throw error;
  await audit(supabaseAdmin, userId, "elevenlabs.assistant.save", { ...args });
  return { ok: true };
}

export type AssistantProfile = {
  sid: string;
  prompt: string | null;
  firstMessage: string | null;
  tone: string;
  language: string;
  fallback: "voicemail" | "forward" | "hangup";
  fallbackNumber: string | null;
  maxDuration: number;
};

/** Full per-number assistant behaviour: prompt, tone and fallback handling. */
export async function saveAssistantProfile(
  supabase: SupabaseClient,
  userId: string,
  args: AssistantProfile,
) {
  await requireAdmin(supabase, userId);
  if (args.fallback === "forward" && !args.fallbackNumber?.trim()) {
    throw new Error("Add a fallback number to forward to, or pick another fallback.");
  }
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { error } = await supabaseAdmin
    .from("phone_numbers")
    .update({
      ai_prompt: args.prompt?.trim() || null,
      ai_first_message: args.firstMessage?.trim() || null,
      ai_tone: args.tone,
      ai_language: args.language,
      ai_fallback: args.fallback,
      ai_fallback_number: args.fallbackNumber?.trim() || null,
      ai_max_duration: Math.min(Math.max(args.maxDuration, 30), 3600),
    })
    .eq("sid", args.sid);
  if (error) throw error;
  await audit(supabaseAdmin, userId, "elevenlabs.assistant.profile", { sid: args.sid });
  return { ok: true };
}

export async function getAssistantProfile(
  supabase: SupabaseClient,
  userId: string,
  args: { sid: string },
) {
  await allowedNumbers(supabase, userId);
  const { data, error } = await supabase
    .from("phone_numbers")
    .select("*")
    .eq("sid", args.sid)
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error("Number not found.");
  return data;
}

/** Synthesize the greeting once and cache it in storage for Twilio to play. */
export async function renderGreeting(
  supabase: SupabaseClient,
  userId: string,
  args: { sid: string; text: string; voiceId: string },
) {
  await requireAdmin(supabase, userId);
  const text = args.text.trim();
  if (!text) throw new Error("Write a greeting first.");

  const audio = await el.synthesize({ voiceId: args.voiceId, text: text.slice(0, 900) });
  const path = `${args.sid}/${Date.now()}.mp3`;

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { error: uploadError } = await supabaseAdmin.storage
    .from(GREETING_BUCKET)
    .upload(path, audio, { contentType: "audio/mpeg", upsert: true });
  if (uploadError) throw uploadError;

  const { error } = await supabaseAdmin
    .from("phone_numbers")
    .update({
      voicemail_greeting: text,
      elevenlabs_voice_id: args.voiceId,
      greeting_audio_path: path,
    })
    .eq("sid", args.sid);
  if (error) throw error;

  return { path, dataUrl: `data:audio/mpeg;base64,${bytesToBase64(audio)}` };
}

export async function conversationForCall(
  supabase: SupabaseClient,
  _userId: string,
  args: { callSid: string },
) {
  const { data, error } = await supabase
    .from("ai_conversations")
    .select("agent_id, conversation_id, summary, transcript, created_at")
    .eq("call_sid", args.callSid)
    .maybeSingle();
  if (error) throw error;
  return data;
}