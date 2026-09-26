import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { LineLanguage } from "@/lib/answering/language";
import type { AfterHoursDestination, WeeklySchedule } from "@/lib/business-hours";
import * as ops from "@/lib/line-automation.server";

export const getLineAutomation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { sid: string }) => input)
  .handler(async ({ context, data }) =>
    ops.getLineAutomation(context.supabase, context.userId, data.sid),
  );

export const saveLineAutomation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: {
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
    }) => input,
  )
  .handler(async ({ context, data }) =>
    ops.saveLineAutomation(context.supabase, context.userId, data),
  );

export const saveLineAnsweringLanguage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { sid: string; language: LineLanguage }) => input)
  .handler(async ({ context, data }) =>
    ops.saveLineAnsweringLanguage(context.supabase, context.userId, data),
  );
