import type { SupabaseClient } from "@supabase/supabase-js";

import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { parseLineLanguage, type LineLanguage } from "@/lib/answering/language";
import { requireAdmin } from "@/lib/app.server";
import { campaignReady, UNREGISTERED_TEXTING_COPY } from "@/lib/automated-text";
import {
  DEFAULT_BUSINESS_TIMEZONE,
  DEFAULT_WEEKLY_SCHEDULE,
  parseHolidayDates,
  parseWeeklySchedule,
  zonedParts,
  type AfterHoursDestination,
  type WeeklySchedule,
} from "@/lib/business-hours";
import { DEFAULT_EMERGENCY_KEYWORDS, parseEmergencyKeywords } from "@/lib/emergency-keywords";
import { syncAnsweringLanguage, syncEmergencyTransfer } from "@/lib/elevenlabs.server";
import {
  DEFAULT_TEXT_BACK_DEDUPE_MINUTES,
  DEFAULT_TEXT_BACK_TEMPLATE,
  resolveTextBackTemplate,
} from "@/lib/missed-call";
import { normalizePhone } from "@/lib/twilio.server";

const LINE_COLUMNS =
  "sid, phone_number, friendly_name, elevenlabs_agent_id, messaging_service_sid, campaign_status, workspace_id, text_back_enabled, text_back_template, text_back_on_ai, text_back_on_voicemail, text_back_dedupe_minutes, business_hours_enabled, business_timezone, business_hours, business_holidays, after_hours_route, emergency_keywords, emergency_transfer_number, ai_language";

export type LineAutomationView = {
  sid: string;
  phoneNumber: string;
  textingRegistered: boolean;
  textingNotice: string | null;
  messagingServiceSid: string | null;
  campaignStatus: string | null;
  textBackEnabled: boolean;
  textBackTemplate: string;
  textBackOnAi: boolean;
  textBackOnVoicemail: boolean;
  textBackDedupeMinutes: number;
  businessHoursEnabled: boolean;
  businessTimezone: string;
  schedule: WeeklySchedule;
  holidays: string[];
  afterHours: AfterHoursDestination;
  emergencyKeywords: string[];
  emergencyTransferNumber: string | null;
  language: LineLanguage;
};

export type LanguageSync = { synced: boolean; detail: string };

export type LineAutomationInput = {
  sid: string;
  textBackEnabled: boolean;
  textBackTemplate: string;
  textBackOnAi: boolean;
  textBackOnVoicemail: boolean;
  textBackDedupeMinutes: number;
  businessHoursEnabled: boolean;
  businessTimezone: string;
  schedule: WeeklySchedule;
  holidays: string[];
  afterHours: AfterHoursDestination;
  emergencyKeywords: string[];
  emergencyTransferNumber: string | null;
  language: LineLanguage;
};

function asView(row: Record<string, unknown>): LineAutomationView {
  const messagingServiceSid = (row["messaging_service_sid"] as string | null) ?? null;
  const campaignStatus = (row["campaign_status"] as string | null) ?? null;
  const registered = Boolean(messagingServiceSid) && campaignReady(campaignStatus);
  const afterHours = row["after_hours_route"] === "voicemail" ? "voicemail" : "ai";
  const keywords = parseEmergencyKeywords(row["emergency_keywords"]);
  const language = parseLineLanguage(row["ai_language"]);
  return {
    sid: row["sid"] as string,
    phoneNumber: row["phone_number"] as string,
    textingRegistered: registered,
    textingNotice: registered ? null : UNREGISTERED_TEXTING_COPY,
    messagingServiceSid,
    campaignStatus,
    textBackEnabled: Boolean(row["text_back_enabled"]),
    textBackTemplate: resolveTextBackTemplate({
      stored: row["text_back_template"] as string | null,
      lineLanguage: language,
      callerSpokeSpanish: false,
    }),
    textBackOnAi: Boolean(row["text_back_on_ai"]),
    textBackOnVoicemail: Boolean(row["text_back_on_voicemail"]),
    textBackDedupeMinutes:
      (row["text_back_dedupe_minutes"] as number | null) ?? DEFAULT_TEXT_BACK_DEDUPE_MINUTES,
    businessHoursEnabled: Boolean(row["business_hours_enabled"]),
    businessTimezone: (row["business_timezone"] as string | null) || DEFAULT_BUSINESS_TIMEZONE,
    schedule: parseWeeklySchedule(row["business_hours"]),
    holidays: parseHolidayDates(row["business_holidays"]),
    afterHours,
    emergencyKeywords: keywords.length > 0 ? keywords : [...DEFAULT_EMERGENCY_KEYWORDS],
    emergencyTransferNumber: (row["emergency_transfer_number"] as string | null) ?? null,
    language,
  };
}

export async function getLineAutomation(
  supabase: SupabaseClient,
  userId: string,
  sid: string,
): Promise<LineAutomationView> {
  await requireAdmin(supabase, userId);
  const { data, error } = await supabase
    .from("phone_numbers")
    .select(LINE_COLUMNS)
    .eq("sid", sid)
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error("Number not found.");
  return asView(data as Record<string, unknown>);
}

export async function saveLineAutomation(
  supabase: SupabaseClient,
  userId: string,
  input: LineAutomationInput,
): Promise<LineAutomationView & { transferSync: LanguageSync; languageSync: LanguageSync }> {
  await requireAdmin(supabase, userId);
  if (!zonedParts(new Date(), input.businessTimezone)) {
    throw new Error("Pick a valid timezone.");
  }
  if (input.afterHours !== "ai" && input.afterHours !== "voicemail") {
    throw new Error("After-hours routing must be the AI receptionist or voicemail.");
  }
  const dedupe = Math.min(1440, Math.max(5, Math.round(input.textBackDedupeMinutes)));
  const keywords = parseEmergencyKeywords(input.emergencyKeywords);
  const transfer = input.emergencyTransferNumber?.trim()
    ? normalizePhone(input.emergencyTransferNumber)
    : null;
  if (transfer && transfer.replace(/\D/g, "").length < 10) {
    throw new Error("Enter a real mobile number for emergency transfer.");
  }
  const holidays = parseHolidayDates(input.holidays);
  const schedule = parseWeeklySchedule(input.schedule);
  const language = parseLineLanguage(input.language);

  const { data: existing, error: readError } = await supabaseAdmin
    .from("phone_numbers")
    .select("elevenlabs_agent_id")
    .eq("sid", input.sid)
    .maybeSingle();
  if (readError) throw readError;
  if (!existing) throw new Error("Number not found.");

  const { error } = await supabaseAdmin
    .from("phone_numbers")
    .update({
      text_back_enabled: input.textBackEnabled,
      text_back_template: input.textBackTemplate.trim().slice(0, 640) || DEFAULT_TEXT_BACK_TEMPLATE,
      text_back_on_ai: input.textBackOnAi,
      text_back_on_voicemail: input.textBackOnVoicemail,
      text_back_dedupe_minutes: dedupe,
      business_hours_enabled: input.businessHoursEnabled,
      business_timezone: input.businessTimezone,
      business_hours: schedule,
      business_holidays: holidays,
      after_hours_route: input.afterHours,
      emergency_keywords: keywords.length > 0 ? keywords : [...DEFAULT_EMERGENCY_KEYWORDS],
      emergency_transfer_number: transfer,
      ai_language: language,
    })
    .eq("sid", input.sid);
  if (error) throw error;

  const agentId = (existing.elevenlabs_agent_id as string | null) ?? null;
  const transferSync = await syncEmergencyTransfer({
    agentId,
    keywords: keywords.length > 0 ? keywords : [...DEFAULT_EMERGENCY_KEYWORDS],
    phone: transfer,
  });
  const languageSync = await syncAnsweringLanguage({ agentId, language });
  const view = await getLineAutomation(supabase, userId, input.sid);
  return { ...view, transferSync, languageSync };
}

export async function saveLineAnsweringLanguage(
  supabase: SupabaseClient,
  userId: string,
  input: { sid: string; language: LineLanguage },
): Promise<{ language: LineLanguage; languageSync: LanguageSync }> {
  await requireAdmin(supabase, userId);
  const language = parseLineLanguage(input.language);
  const { data: existing, error: readError } = await supabaseAdmin
    .from("phone_numbers")
    .select("elevenlabs_agent_id")
    .eq("sid", input.sid)
    .maybeSingle();
  if (readError) throw readError;
  if (!existing) throw new Error("Number not found.");
  const { error } = await supabaseAdmin
    .from("phone_numbers")
    .update({ ai_language: language })
    .eq("sid", input.sid);
  if (error) throw error;
  const languageSync = await syncAnsweringLanguage({
    agentId: (existing.elevenlabs_agent_id as string | null) ?? null,
    language,
  });
  return { language, languageSync };
}

export { DEFAULT_WEEKLY_SCHEDULE };
