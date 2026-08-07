import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import * as ops from "./twilio-ops.server";


export const getBootstrap = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => ops.bootstrap(context.supabase, context.userId));

export const syncNumbers = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => ops.syncNumbers(context.supabase, context.userId));

export const assignNumber = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { sid: string; assignedTo: string | null }) => input)
  .handler(async ({ context, data }) => ops.assignNumber(context.supabase, context.userId, data));

export const updateNumberSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
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
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { sid: string }) => input)
  .handler(async ({ context, data }) => ops.wireNumber(context.supabase, context.userId, data));

export const searchAvailableNumbers = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: { country: string; areaCode?: string; contains?: string; type: string }) => input,
  )
  .handler(async ({ context, data }) =>
    ops.searchAvailableNumbers(context.supabase, context.userId, data),
  );

export const purchaseNumber = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { phoneNumber: string }) => input)
  .handler(async ({ context, data }) => ops.purchaseNumber(context.supabase, context.userId, data));

export const releaseNumber = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { sid: string }) => input)
  .handler(async ({ context, data }) => ops.releaseNumber(context.supabase, context.userId, data));

export const sendMessage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: {
      appNumber: string;
      to: string;
      body: string;
      channel: "sms" | "whatsapp";
      mediaUrls?: string[];
      sendAt?: string | null;
      messagingServiceSid?: string | null;
    }) => input,
  )
  .handler(async ({ context, data }) => ops.sendMessage(context.supabase, context.userId, data));

export const addInternalNote = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { conversationId: string; body: string }) => input)
  .handler(async ({ context, data }) =>
    ops.addInternalNote(context.supabase, context.userId, data),
  );

export const markConversationRead = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { conversationId: string }) => input)
  .handler(async ({ context, data }) =>
    ops.markConversationRead(context.supabase, context.userId, data),
  );

export const setConversationFlags = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: { conversationId: string; assignedTo?: string | null; archived?: boolean }) => input,
  )
  .handler(async ({ context, data }) =>
    ops.setConversationFlags(context.supabase, context.userId, data),
  );

export const importHistory = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => ops.importHistory(context.supabase, context.userId));

export const importCallHistory = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => ops.importCallHistory(context.supabase, context.userId));

export const startCall = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { appNumber: string; to: string; callbackNumber?: string | null }) => input)
  .handler(async ({ context, data }) => ops.startCall(context.supabase, context.userId, data));

export const listCallerIds = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => ops.listCallerIds(context.supabase, context.userId));

export const requestCallerIdVerification = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { phoneNumber: string; friendlyName?: string }) => input)
  .handler(async ({ context, data }) =>
    ops.requestCallerIdVerification(context.supabase, context.userId, data),
  );

export const deleteCallerId = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { sid: string; phoneNumber?: string }) => input)
  .handler(async ({ context, data }) =>
    ops.deleteCallerId(context.supabase, context.userId, data),
  );

export const setOutboundCallerId = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { sid: string; callerId: string | null }) => input)
  .handler(async ({ context, data }) =>
    ops.setOutboundCallerId(context.supabase, context.userId, data),
  );

export const setDefaultNumber = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { phoneNumber: string | null }) => input)
  .handler(async ({ context, data }) =>
    ops.setDefaultNumber(context.supabase, context.userId, data),
  );

export const sendTestCall = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { appNumber?: string | null; to?: string | null }) => input)
  .handler(async ({ context, data }) => ops.sendTestCall(context.supabase, context.userId, data));

export const listCallerIdRoutes = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => ops.listCallerIdRoutes(context.supabase, context.userId));

export const upsertCallerIdRoute = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: { id?: string; pattern: string; callerId: string; label?: string | null }) => input,
  )
  .handler(async ({ context, data }) =>
    ops.upsertCallerIdRoute(context.supabase, context.userId, data),
  );

export const deleteCallerIdRoute = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string }) => input)
  .handler(async ({ context, data }) =>
    ops.deleteCallerIdRoute(context.supabase, context.userId, data),
  );

export const setContactCallerId = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { phoneNumber: string; callerId: string | null }) => input)
  .handler(async ({ context, data }) =>
    ops.setContactCallerId(context.supabase, context.userId, data),
  );

export const getCallRecordings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { sid: string }) => input)
  .handler(async ({ context, data }) =>
    ops.getCallRecordings(context.supabase, context.userId, data),
  );

export const getRecordingAudio = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { sid: string }) => input)
  .handler(async ({ context, data }) =>
    ops.getRecordingAudio(context.supabase, context.userId, data),
  );

export const listVerifyServices = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => ops.listVerifyServices(context.supabase, context.userId));

export const createVerifyService = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { name: string }) => input)
  .handler(async ({ context, data }) =>
    ops.createVerifyService(context.supabase, context.userId, data),
  );

export const startVerification = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { serviceSid: string; to: string; channel: string }) => input)
  .handler(async ({ context, data }) =>
    ops.startVerification(context.supabase, context.userId, data),
  );

export const checkVerification = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { serviceSid: string; to: string; code: string }) => input)
  .handler(async ({ context, data }) =>
    ops.checkVerification(context.supabase, context.userId, data),
  );

export const lookupNumber = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { phone: string }) => input)
  .handler(async ({ context, data }) => ops.lookupNumber(context.supabase, context.userId, data));

export const listLookups = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => ops.listLookups(context.supabase, context.userId));

export const accountOverview = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => ops.accountOverview(context.supabase, context.userId));

export const listMessagingServices = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => ops.listMessagingServices(context.supabase, context.userId));

export const messagingServiceDetail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { serviceSid: string }) => input)
  .handler(async ({ context, data }) =>
    ops.messagingServiceDetail(context.supabase, context.userId, data),
  );

export const createMessagingService = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { name: string }) => input)
  .handler(async ({ context, data }) =>
    ops.createMessagingService(context.supabase, context.userId, data),
  );

export const addNumberToMessagingService = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { serviceSid: string; numberSid: string }) => input)
  .handler(async ({ context, data }) =>
    ops.addNumberToMessagingService(context.supabase, context.userId, data),
  );

export const removeNumberFromMessagingService = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { serviceSid: string; numberSid: string }) => input)
  .handler(async ({ context, data }) =>
    ops.removeNumberFromMessagingService(context.supabase, context.userId, data),
  );

/* ------------------------------------------------------ twiml app + voice */

export const voiceSetupStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => ops.voiceSetupStatus(context.supabase, context.userId));

export const listTwimlApps = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => ops.listTwimlApps(context.supabase, context.userId));

export const createTwimlApp = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { name: string }) => input)
  .handler(async ({ context, data }) =>
    ops.createTwimlApp(context.supabase, context.userId, data),
  );

export const syncTwimlApp = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { sid: string }) => input)
  .handler(async ({ context, data }) => ops.syncTwimlApp(context.supabase, context.userId, data));

export const setDefaultTwimlApp = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { sid: string }) => input)
  .handler(async ({ context, data }) =>
    ops.setDefaultTwimlApp(context.supabase, context.userId, data),
  );

export const deleteTwimlApp = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { sid: string }) => input)
  .handler(async ({ context, data }) =>
    ops.deleteTwimlApp(context.supabase, context.userId, data),
  );

export const getVoiceToken = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => ops.voiceToken(context.supabase, context.userId));

export const rawTwilioCall = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { method: string; path: string; host: string; params: string }) => input)
  .handler(async ({ context, data }) => ops.rawTwilioCall(context.supabase, context.userId, data));

export const setVoicePresence = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { online: boolean }) => input)
  .handler(async ({ context, data }) =>
    ops.setVoicePresence(context.supabase, context.userId, data.online),
  );

export const listTeam = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => ops.listTeam(context.supabase, context.userId));

export const setTeamRole = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { targetUserId: string; role: "owner" | "admin" | "agent" }) => input)
  .handler(async ({ context, data }) => ops.setTeamRole(context.supabase, context.userId, data));

export const updateMyProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { displayName?: string; agentPhone?: string | null }) => input)
  .handler(async ({ context, data }) =>
    ops.updateMyProfile(context.supabase, context.userId, data),
  );

export const signMediaUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { path: string }) => input)
  .handler(async ({ context, data }) => ops.signMediaUrl(context.supabase, context.userId, data));