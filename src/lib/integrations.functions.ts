import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import * as ops from "./integrations-ops.server";

/* status + preferences */

export const getIntegrationStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => ops.integrationStatus(context.supabase, context.userId));

export const getNotificationPrefs = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => ops.getPrefs(context.supabase, context.userId));

export const saveNotificationPrefs = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: ops.PrefsInput) => input)
  .handler(async ({ context, data }) => ops.savePrefs(context.supabase, context.userId, data));

export const sendTestEmail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { to?: string }) => input)
  .handler(async ({ context, data }) => ops.sendTest(context.supabase, context.userId, data.to));

export const sendAccountEmail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: {
      to: string;
      kind: "welcome" | "invite" | "number-provisioned" | "usage-warning";
      detail?: string;
    }) => input,
  )
  .handler(async ({ context, data }) =>
    ops.sendAccountEmail(context.supabase, context.userId, data),
  );

/* gmail */

export const searchMail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { query?: string; email?: string; max?: number }) => input)
  .handler(async ({ context, data }) => ops.mailSearch(context.userId, data));

export const readMailThread = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { threadId: string }) => input)
  .handler(async ({ context, data }) => ops.mailThread(context.userId, data.threadId));

export const sendMailMessage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: { to: string; subject: string; body: string; threadId?: string }) => input,
  )
  .handler(async ({ context, data }) => ops.mailSend(context.userId, data));

export const replyMailThread = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { threadId: string; body: string }) => input)
  .handler(async ({ context, data }) => ops.mailReply(context.userId, data));

export const getMailUnread = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => ops.mailUnread(context.userId));

/* calendar */

export const listCalendars = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async () => ops.calendars());

export const listUpcomingEvents = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { calendarId?: string; q?: string; max?: number }) => input)
  .handler(async ({ data }) => ops.upcoming(data));

export const getBookingSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { sid: string }) => input)
  .handler(async ({ context, data }) => ops.numberBookingSettings(context.supabase, data.sid));

export const saveBookingSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: {
      sid: string;
      calendarId: string | null;
      enabled: boolean;
      slotMinutes: number;
      bufferMinutes: number;
      timezone: string;
      hours: { start: string; end: string; days: number[] };
      travelMinutes?: number;
      confirmMode?: "confirm" | "automatic";
      serviceAreaMode?: "off" | "radius" | "zips";
      serviceAreaRadiusMiles?: number | null;
      serviceAreaAddress?: string | null;
      serviceAreaLat?: number | null;
      serviceAreaLng?: number | null;
      serviceAreaZips?: string[];
    }) => input,
  )
  .handler(async ({ context, data }) =>
    ops.saveBookingSettings(context.supabase, context.userId, data),
  );

export const listOpenSlots = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { appNumber: string }) => input)
  .handler(async ({ context, data }) => ops.slotsForNumber(context.supabase, data.appNumber));

export const createBooking = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: {
      appNumber: string;
      start: string;
      end: string;
      summary: string;
      description?: string;
      contactNumber?: string;
      contactEmail?: string;
      conversationId?: string;
      callSid?: string;
    }) => input,
  )
  .handler(async ({ context, data }) => ops.bookSlot(context.supabase, context.userId, data));

export const listBookings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { appNumber?: string }) => input)
  .handler(async ({ context, data }) => ops.bookingsForNumber(context.supabase, data.appNumber));

/* maps + contacts */

export const searchPlaces = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { query: string }) => input)
  .handler(async ({ data }) => ops.places(data.query));

export const geocodeAddress = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { address: string }) => input)
  .handler(async ({ data }) => ops.geocodeAddress(data.address));

export const getContactCard = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { phoneNumber: string }) => input)
  .handler(async ({ context, data }) => ops.getContact(context.supabase, data.phoneNumber));

export const saveContactCard = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: { phoneNumber: string; name?: string; email?: string; address?: string }) => input,
  )
  .handler(async ({ context, data }) => ops.saveContactLocation(context.supabase, data));
