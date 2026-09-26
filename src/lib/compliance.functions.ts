import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { audit, requireAdmin } from "@/lib/app.server";

import { recordAiVoiceConsent } from "./compliance/ai-consent.server";
import {
  acknowledgeE911,
  listEmergencyAddresses,
  registerEmergencyAddress,
  userAcknowledgedE911,
} from "./compliance/e911.server";
import {
  confirmAdvancedOptOut,
  getQuietHours,
  recordSmsConsent,
  saveQuietHours,
} from "./compliance/opt-out.server";
import { setLineRecording } from "./compliance/recording.server";
import { composeAiFirstMessage } from "./compliance/recording-copy";
import { confirmTrustHub, loadTrustHubDraft } from "./compliance/trusthub.server";
import type { BusinessIdType } from "./compliance/trusthub";

async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

export const getE911Gate = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const db = await admin();
    const acknowledged = await userAcknowledgedE911(db as never, context.userId);
    return { acknowledged };
  });

export const acknowledgeE911Disclosure = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => acknowledgeE911(context.supabase as never, context.userId));

export const getEmergencyAddresses = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await requireAdmin(context.supabase as never, context.userId);
    return listEmergencyAddresses((await admin()) as never);
  });

export const saveEmergencyAddress = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: {
      phoneNumberSid: string;
      phoneNumber: string;
      customerName: string;
      street: string;
      streetSecondary?: string;
      city: string;
      region: string;
      postalCode: string;
      isoCountry: string;
      confirmMonthlyFee: boolean;
      moved?: boolean;
    }) => input,
  )
  .handler(async ({ context, data }) => {
    await requireAdmin(context.supabase as never, context.userId);
    return registerEmergencyAddress(context.userId, data);
  });

export const setCallRecording = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { sid: string; recordCalls: boolean }) => input)
  .handler(async ({ context, data }) => {
    await requireAdmin(context.supabase as never, context.userId);
    const db = await admin();
    const { data: line } = await db
      .from("phone_numbers")
      .select("ai_first_message")
      .eq("sid", data.sid)
      .maybeSingle();
    await setLineRecording(db as never, data);
    if (line) {
      await db
        .from("phone_numbers")
        .update({
          ai_first_message: composeAiFirstMessage(
            line.ai_first_message as string | null,
            data.recordCalls,
          ),
        })
        .eq("sid", data.sid);
    }
    await audit(db as never, context.userId, "recording.toggle", {
      sid: data.sid,
      record_calls: data.recordCalls,
    });
    return { ok: true as const };
  });

export const getQuietHoursSettings = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => getQuietHours(context.userId));

export const saveQuietHoursSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: { enabled: boolean; quietStart: string; quietEnd: string; timezone: string }) => input,
  )
  .handler(async ({ context, data }) => saveQuietHours(context.userId, data));

export const logSmsConsent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: {
      phoneNumber: string;
      purpose: "review" | "marketing";
      consented: boolean;
      source: string;
    }) => input,
  )
  .handler(async ({ context, data }) => recordSmsConsent(context.userId, data));

export const confirmMessagingAdvancedOptOut = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { messagingServiceSid: string; confirmed: boolean }) => input)
  .handler(async ({ context, data }) => {
    await requireAdmin(context.supabase as never, context.userId);
    if (!data.confirmed) {
      throw new Error("Confirm that Advanced Opt-Out is enabled on this Messaging Service.");
    }
    return confirmAdvancedOptOut(context.userId, data.messagingServiceSid);
  });

export const getTrustHubDraft = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => loadTrustHubDraft(context.userId));

export const saveTrustHubConfirmation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: {
      ownerConfirmed: boolean;
      cnamDisplayName: string;
      businessIdType: BusinessIdType;
      voiceIntegrityUseCase: string;
      employeeCount: number;
      dailyCallVolume: number;
      includeShakenStir: boolean;
      includeCnam: boolean;
      includeVoiceIntegrity: boolean;
    }) => input,
  )
  .handler(async ({ context, data }) =>
    confirmTrustHub(context.supabase as never, context.userId, data),
  );

export const logAiVoiceConsent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { phoneNumber: string; consented: boolean; source: string }) => input)
  .handler(async ({ context, data }) => recordAiVoiceConsent(context.userId, data));
