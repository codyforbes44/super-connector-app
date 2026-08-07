import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import * as ops from "./elevenlabs-ops.server";

const auth = requireSupabaseAuth;

export const elevenLabsStatus = createServerFn({ method: "GET" })
  .middleware([auth])
  .handler(async ({ context }) => ops.status(context.supabase, context.userId));

export const listElevenLabsVoices = createServerFn({ method: "GET" })
  .middleware([auth])
  .handler(async ({ context }) => ops.voices(context.supabase, context.userId));

export const listElevenLabsAgents = createServerFn({ method: "GET" })
  .middleware([auth])
  .handler(async ({ context }) => ops.agents(context.supabase, context.userId));

export const previewVoice = createServerFn({ method: "POST" })
  .middleware([auth])
  .inputValidator((input: { voiceId: string; text?: string }) => input)
  .handler(async ({ context, data }) => ops.preview(context.supabase, context.userId, data));

export const saveVoiceAssistant = createServerFn({ method: "POST" })
  .middleware([auth])
  .inputValidator(
    (input: {
      sid: string;
      answerMode: "classic" | "ai_agent";
      voiceId: string | null;
      agentId: string | null;
    }) => input,
  )
  .handler(async ({ context, data }) => ops.saveAssistant(context.supabase, context.userId, data));

export const renderGreeting = createServerFn({ method: "POST" })
  .middleware([auth])
  .inputValidator((input: { sid: string; text: string; voiceId: string }) => input)
  .handler(async ({ context, data }) => ops.renderGreeting(context.supabase, context.userId, data));

export const getCallConversation = createServerFn({ method: "POST" })
  .middleware([auth])
  .inputValidator((input: { callSid: string }) => input)
  .handler(async ({ context, data }) =>
    ops.conversationForCall(context.supabase, context.userId, data),
  );

export const getAssistantProfile = createServerFn({ method: "POST" })
  .middleware([auth])
  .inputValidator((input: { sid: string }) => input)
  .handler(async ({ context, data }) =>
    ops.getAssistantProfile(context.supabase, context.userId, data),
  );

export const saveAssistantProfile = createServerFn({ method: "POST" })
  .middleware([auth])
  .inputValidator((input: ops.AssistantProfile) => input)
  .handler(async ({ context, data }) =>
    ops.saveAssistantProfile(context.supabase, context.userId, data),
  );