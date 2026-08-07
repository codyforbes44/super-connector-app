import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import * as ops from "./twilio-ops.server";

const auth = requireSupabaseAuth;

export const getBootstrap = createServerFn({ method: "GET" })
  .middleware([auth])
  .handler(async ({ context }) => ops.bootstrap(context.supabase, context.userId));

export const syncNumbers = createServerFn({ method: "POST" })
  .middleware([auth])
  .handler(async ({ context }) => ops.syncNumbers(context.supabase, context.userId));

export const assignNumber = createServerFn({ method: "POST" })
  .middleware([auth])
  .inputValidator((input: { sid: string; assignedTo: string | null }) => input)
  .handler(async ({ context, data }) => ops.assignNumber(context.supabase, context.userId, data));

export const updateNumberSettings = createServerFn({ method: "POST" })
  .middleware([auth])
  .inputValidator(
    (input: {
      sid: string;
      friendlyName?: string;
      forwardTo?: string | null;
      voicemailGreeting?: string | null;
      channelWhatsapp?: boolean;
    }) => input,
  )
  .handler(async ({ context, data }) =>
    ops.updateNumberSettings(context.supabase, context.userId, data),
  );

export const wireNumber = createServerFn({ method: "POST" })
  .middleware([auth])
  .inputValidator((input: { sid: string }) => input)
  .handler(async ({ context, data }) => ops.wireNumber(context.supabase, context.userId, data));

export const searchAvailableNumbers = createServerFn({ method: "POST" })
  .middleware([auth])
  .inputValidator(
    (input: { country: string; areaCode?: string; contains?: string; type: string }) => input,
  )
  .handler(async ({ context, data }) =>
    ops.searchAvailableNumbers(context.supabase, context.userId, data),
  );

export const purchaseNumber = createServerFn({ method: "POST" })
  .middleware([auth])
  .inputValidator((input: { phoneNumber: string }) => input)
  .handler(async ({ context, data }) => ops.purchaseNumber(context.supabase, context.userId, data));

export const releaseNumber = createServerFn({ method: "POST" })
  .middleware([auth])
  .inputValidator((input: { sid: string }) => input)
  .handler(async ({ context, data }) => ops.releaseNumber(context.supabase, context.userId, data));

export const sendMessage = createServerFn({ method: "POST" })
  .middleware([auth])
  .inputValidator(
    (input: {
      appNumber: string;
      to: string;
      body: string;
      channel: "sms" | "whatsapp";
      mediaUrls?: string[];
      sendAt?: string | null;
    }) => input,
  )
  .handler(async ({ context, data }) => ops.sendMessage(context.supabase, context.userId, data));

export const addInternalNote = createServerFn({ method: "POST" })
  .middleware([auth])
  .inputValidator((input: { conversationId: string; body: string }) => input)
  .handler(async ({ context, data }) =>
    ops.addInternalNote(context.supabase, context.userId, data),
  );

export const markConversationRead = createServerFn({ method: "POST" })
  .middleware([auth])
  .inputValidator((input: { conversationId: string }) => input)
  .handler(async ({ context, data }) =>
    ops.markConversationRead(context.supabase, context.userId, data),
  );

export const setConversationFlags = createServerFn({ method: "POST" })
  .middleware([auth])
  .inputValidator(
    (input: { conversationId: string; assignedTo?: string | null; archived?: boolean }) => input,
  )
  .handler(async ({ context, data }) =>
    ops.setConversationFlags(context.supabase, context.userId, data),
  );

export const importHistory = createServerFn({ method: "POST" })
  .middleware([auth])
  .handler(async ({ context }) => ops.importHistory(context.supabase, context.userId));

export const importCallHistory = createServerFn({ method: "POST" })
  .middleware([auth])
  .handler(async ({ context }) => ops.importCallHistory(context.supabase, context.userId));

export const startCall = createServerFn({ method: "POST" })
  .middleware([auth])
  .inputValidator((input: { appNumber: string; to: string }) => input)
  .handler(async ({ context, data }) => ops.startCall(context.supabase, context.userId, data));

export const getCallRecordings = createServerFn({ method: "POST" })
  .middleware([auth])
  .inputValidator((input: { sid: string }) => input)
  .handler(async ({ context, data }) =>
    ops.getCallRecordings(context.supabase, context.userId, data),
  );

export const getRecordingAudio = createServerFn({ method: "POST" })
  .middleware([auth])
  .inputValidator((input: { sid: string }) => input)
  .handler(async ({ context, data }) =>
    ops.getRecordingAudio(context.supabase, context.userId, data),
  );

export const listVerifyServices = createServerFn({ method: "GET" })
  .middleware([auth])
  .handler(async ({ context }) => ops.listVerifyServices(context.supabase, context.userId));

export const createVerifyService = createServerFn({ method: "POST" })
  .middleware([auth])
  .inputValidator((input: { name: string }) => input)
  .handler(async ({ context, data }) =>
    ops.createVerifyService(context.supabase, context.userId, data),
  );

export const startVerification = createServerFn({ method: "POST" })
  .middleware([auth])
  .inputValidator((input: { serviceSid: string; to: string; channel: string }) => input)
  .handler(async ({ context, data }) =>
    ops.startVerification(context.supabase, context.userId, data),
  );

export const checkVerification = createServerFn({ method: "POST" })
  .middleware([auth])
  .inputValidator((input: { serviceSid: string; to: string; code: string }) => input)
  .handler(async ({ context, data }) =>
    ops.checkVerification(context.supabase, context.userId, data),
  );

export const lookupNumber = createServerFn({ method: "POST" })
  .middleware([auth])
  .inputValidator((input: { phone: string }) => input)
  .handler(async ({ context, data }) => ops.lookupNumber(context.supabase, context.userId, data));

export const listLookups = createServerFn({ method: "GET" })
  .middleware([auth])
  .handler(async ({ context }) => ops.listLookups(context.supabase, context.userId));

export const accountOverview = createServerFn({ method: "GET" })
  .middleware([auth])
  .handler(async ({ context }) => ops.accountOverview(context.supabase, context.userId));

export const rawTwilioCall = createServerFn({ method: "POST" })
  .middleware([auth])
  .inputValidator((input: { method: string; path: string; host: string; params: string }) => input)
  .handler(async ({ context, data }) => ops.rawTwilioCall(context.supabase, context.userId, data));

export const listTeam = createServerFn({ method: "GET" })
  .middleware([auth])
  .handler(async ({ context }) => ops.listTeam(context.supabase, context.userId));

export const setTeamRole = createServerFn({ method: "POST" })
  .middleware([auth])
  .inputValidator((input: { targetUserId: string; role: "owner" | "admin" | "agent" }) => input)
  .handler(async ({ context, data }) => ops.setTeamRole(context.supabase, context.userId, data));

export const updateMyProfile = createServerFn({ method: "POST" })
  .middleware([auth])
  .inputValidator((input: { displayName?: string; agentPhone?: string | null }) => input)
  .handler(async ({ context, data }) =>
    ops.updateMyProfile(context.supabase, context.userId, data),
  );

export const signMediaUrl = createServerFn({ method: "POST" })
  .middleware([auth])
  .inputValidator((input: { path: string }) => input)
  .handler(async ({ context, data }) => ops.signMediaUrl(context.supabase, context.userId, data));