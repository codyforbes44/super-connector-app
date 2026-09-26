import type { SupabaseClient } from "@supabase/supabase-js";

import { requireAdmin } from "./app.server";
import { publishOutboundEvent } from "./outbound-webhooks.server";
import { appBaseUrl, emailConfigured, emailStatus, FROM_ACCOUNT, sendEmail } from "./email.server";
import { account as accountEmail, testEmail } from "./email-templates/index";
import * as gcal from "./gcal.server";
import * as gmailUser from "./gmail-user.server";
import * as maps from "./maps.server";

async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin as unknown as SupabaseClient;
}

/* ---------------------------------------------------------------- status */

export async function integrationStatus(supabase: SupabaseClient, userId: string) {
  const db = await admin();
  const email = await emailStatus(db);

  const { getConnectionMeta } = await import("./app-user-connections.server");
  const gmailMeta = await getConnectionMeta(userId, "google_mail");
  const mailbox = (gmailMeta?.account_email as string | null) ?? null;

  let calendars: gcal.CalendarSummary[] = [];
  if (gcal.calendarConfigured()) {
    try {
      calendars = await gcal.listCalendars();
    } catch {
      calendars = [];
    }
  }

  return {
    email,
    gmail: { connected: Boolean(gmailMeta), mailbox },
    calendar: { connected: gcal.calendarConfigured(), calendars },
    maps: { connected: maps.mapsConfigured() },
  };
}

/* ------------------------------------------------------------ preferences */

export async function getPrefs(supabase: SupabaseClient, userId: string) {
  const { data } = await supabase
    .from("notification_prefs")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();
  const { data: profile } = await supabase
    .from("profiles")
    .select("email")
    .eq("id", userId)
    .maybeSingle();
  return {
    prefs: data ?? null,
    fallbackEmail: (profile?.email as string | null) ?? null,
  };
}

export type PrefsInput = {
  email_address?: string | null;
  email_missed_call?: boolean;
  email_voicemail?: boolean;
  email_inbound_message?: boolean;
  email_ai_summary?: boolean;
  email_account?: boolean;
  email_daily_digest?: boolean;
  digest_mode?: string;
  quiet_hours_enabled?: boolean;
  quiet_start?: string;
  quiet_end?: string;
  timezone?: string;
};

export async function savePrefs(supabase: SupabaseClient, userId: string, input: PrefsInput) {
  const { error } = await supabase
    .from("notification_prefs")
    .upsert({ user_id: userId, ...input }, { onConflict: "user_id" });
  if (error) throw error;
  return { ok: true };
}

export async function sendTest(supabase: SupabaseClient, userId: string, to?: string) {
  const { prefs, fallbackEmail } = await getPrefs(supabase, userId);
  const address = to || (prefs?.email_address as string | null) || fallbackEmail;
  if (!address) throw new Error("Add an email address first.");
  const db = await admin();
  const result = await sendEmail(db, {
    to: address,
    template: "test",
    rendered: testEmail(appBaseUrl()),
  });
  if (!result.sent) throw new Error(result.error ?? "Send failed");
  return { ok: true, to: address };
}

export async function sendAccountEmail(
  supabase: SupabaseClient,
  userId: string,
  input: {
    to: string;
    kind: "welcome" | "invite" | "number-provisioned" | "usage-warning";
    detail?: string;
  },
) {
  await requireAdmin(supabase, userId);
  const db = await admin();
  const rendered = accountEmail({
    baseUrl: appBaseUrl(),
    kind: input.kind,
    ...(input.detail ? { detail: input.detail } : {}),
  });
  const result = await sendEmail(db, {
    to: input.to,
    template: "account",
    rendered,
    from: FROM_ACCOUNT,
  });
  if (!result.sent) throw new Error(result.error ?? "Send failed");
  return { ok: true };
}

/* ----------------------------------------------------------------- gmail */

export async function mailSearch(
  userId: string,
  input: { query?: string; email?: string; max?: number },
) {
  const q = input.email ? `from:${input.email} OR to:${input.email}` : (input.query ?? "");
  try {
    const messages = await gmailUser.listMessages(userId, {
      q,
      ...(input.max ? { max: input.max } : {}),
    });
    return { connected: true, messages };
  } catch (error) {
    if (error instanceof gmailUser.GmailNotConnected) {
      return { connected: false, messages: [] as gmailUser.MailSummary[] };
    }
    console.error("gmail search failed", error);
    return { connected: true, messages: [], error: "Gmail request failed." };
  }
}

export async function mailThread(userId: string, threadId: string) {
  return gmailUser.getThread(userId, threadId);
}

export async function mailSend(
  userId: string,
  input: { to: string; subject: string; body: string; threadId?: string },
) {
  const sent = await gmailUser.sendMail(userId, input);
  return { ok: true, id: sent.id, threadId: sent.threadId };
}

export async function mailReply(userId: string, input: { threadId: string; body: string }) {
  const sent = await gmailUser.replyToThread(userId, input);
  return { ok: true, id: sent.id, threadId: sent.threadId };
}

export async function mailUnread(userId: string) {
  try {
    return { connected: true, unread: await gmailUser.unreadCount(userId) };
  } catch (error) {
    if (error instanceof gmailUser.GmailNotConnected) return { connected: false, unread: 0 };
    console.error("gmail unread count failed", error);
    return { connected: true, unread: 0 };
  }
}

/* -------------------------------------------------------------- calendar */

export async function calendars() {
  if (!gcal.calendarConfigured()) return [];
  return gcal.listCalendars();
}

export async function upcoming(input: { calendarId?: string; q?: string; max?: number }) {
  if (!gcal.calendarConfigured()) return { connected: false, events: [] as gcal.CalendarEvent[] };
  try {
    const events = await gcal.listEvents(input);
    return { connected: true, events };
  } catch (error) {
    console.error("calendar list failed", error);
    return { connected: true, events: [], error: "Calendar request failed." };
  }
}

type NumberBookingRow = {
  calendar_id: string | null;
  booking_enabled: boolean;
  booking_slot_minutes: number;
  booking_buffer_minutes: number;
  booking_timezone: string;
  booking_hours: { start: string; end: string; days: number[] };
};

export async function numberBookingSettings(supabase: SupabaseClient, sid: string) {
  const { data } = await supabase
    .from("phone_numbers")
    .select(
      "sid, phone_number, calendar_id, booking_enabled, booking_slot_minutes, booking_buffer_minutes, booking_timezone, booking_hours",
    )
    .eq("sid", sid)
    .maybeSingle();
  return data;
}

export async function saveBookingSettings(
  supabase: SupabaseClient,
  userId: string,
  input: {
    sid: string;
    calendarId: string | null;
    enabled: boolean;
    slotMinutes: number;
    bufferMinutes: number;
    timezone: string;
    hours: { start: string; end: string; days: number[] };
  },
) {
  await requireAdmin(supabase, userId);
  const { error } = await supabase
    .from("phone_numbers")
    .update({
      calendar_id: input.calendarId,
      booking_enabled: input.enabled,
      booking_slot_minutes: input.slotMinutes,
      booking_buffer_minutes: input.bufferMinutes,
      booking_timezone: input.timezone,
      booking_hours: input.hours,
    })
    .eq("sid", input.sid);
  if (error) throw error;
  return { ok: true };
}

export async function slotsForNumber(supabase: SupabaseClient, appNumber: string) {
  const { data } = await supabase
    .from("phone_numbers")
    .select(
      "calendar_id, booking_enabled, booking_slot_minutes, booking_buffer_minutes, booking_timezone, booking_hours",
    )
    .eq("phone_number", appNumber)
    .maybeSingle();
  const row = data as NumberBookingRow | null;
  const calendarId = row?.calendar_id || "primary";
  if (!gcal.calendarConfigured()) return { connected: false, slots: [] as gcal.Slot[] };
  const slots = await gcal.availableSlots({
    calendarId,
    slotMinutes: row?.booking_slot_minutes ?? 30,
    bufferMinutes: row?.booking_buffer_minutes ?? 0,
    hours: row?.booking_hours ?? { start: "09:00", end: "17:00", days: [1, 2, 3, 4, 5] },
    timeZone: row?.booking_timezone ?? "UTC",
  });
  return { connected: true, slots, calendarId };
}

export async function bookSlot(
  supabase: SupabaseClient,
  userId: string,
  input: {
    appNumber: string;
    start: string;
    end: string;
    summary: string;
    description?: string;
    contactNumber?: string;
    contactEmail?: string;
    conversationId?: string;
    callSid?: string;
  },
) {
  const { data: number } = await supabase
    .from("phone_numbers")
    .select("calendar_id, booking_timezone")
    .eq("phone_number", input.appNumber)
    .maybeSingle();
  const calendarId = (number?.calendar_id as string | null) || "primary";

  const event = await gcal.createEvent({
    calendarId,
    summary: input.summary,
    ...(input.description ? { description: input.description } : {}),
    start: input.start,
    end: input.end,
    ...(number?.booking_timezone ? { timeZone: number.booking_timezone as string } : {}),
    attendees: input.contactEmail ? [input.contactEmail] : [],
  });

  const db = await admin();
  await db.from("calendar_bookings").insert({
    event_id: event.id,
    calendar_id: calendarId,
    app_number: input.appNumber,
    contact_number: input.contactNumber ?? null,
    contact_email: input.contactEmail ?? null,
    summary: event.summary,
    html_link: event.htmlLink ?? null,
    starts_at: input.start,
    ends_at: input.end,
    source: "manual",
    call_sid: input.callSid ?? null,
    conversation_id: input.conversationId ?? null,
    created_by: userId,
  });

  try {
    let workspaceId: string | null = null;
    const { data: owner, error: ownerError } = await supabase
      .from("phone_numbers")
      .select("workspace_id")
      .eq("phone_number", input.appNumber)
      .maybeSingle();
    if (!ownerError) workspaceId = (owner?.workspace_id as string | null) ?? null;
    await publishOutboundEvent(db, {
      type: "booking.created",
      eventId: `booking.created:${event.id}`,
      workspaceId,
      data: {
        event_id: event.id,
        app_number: input.appNumber,
        summary: event.summary,
        starts_at: input.start,
        ends_at: input.end,
        contact_number: input.contactNumber ?? null,
        contact_email: input.contactEmail ?? null,
      },
    });
  } catch (error) {
    console.error("booking webhook publish failed", error);
  }

  return event;
}

export async function bookingsForNumber(supabase: SupabaseClient, appNumber?: string) {
  let query = supabase
    .from("calendar_bookings")
    .select("*")
    .order("starts_at", { ascending: true })
    .limit(25);
  if (appNumber) query = query.eq("app_number", appNumber);
  const { data } = await query;
  return data ?? [];
}

/* ------------------------------------------------------------------ maps */

export async function places(query: string) {
  if (!maps.mapsConfigured()) return { connected: false, results: [] as maps.PlaceResult[] };
  try {
    return { connected: true, results: await maps.searchPlaces(query) };
  } catch (error) {
    console.error("places search failed", error);
    return { connected: true, results: [], error: "Places request failed." };
  }
}

export async function geocodeAddress(address: string) {
  if (!maps.mapsConfigured()) return null;
  return maps.geocode(address);
}

export async function saveContactLocation(
  supabase: SupabaseClient,
  input: { phoneNumber: string; name?: string; email?: string; address?: string },
) {
  const patch: Record<string, unknown> = { phone_number: input.phoneNumber };
  if (input.name !== undefined) patch["name"] = input.name;
  if (input.email !== undefined) patch["email"] = input.email;

  if (input.address) {
    patch["address"] = input.address;
    const geo = await geocodeAddress(input.address).catch(() => null);
    if (geo) {
      patch["address"] = geo.formatted;
      patch["lat"] = geo.lat;
      patch["lng"] = geo.lng;
      patch["place_id"] = geo.placeId;
    }
  }

  const { data: existing } = await supabase
    .from("contacts")
    .select("id")
    .eq("phone_number", input.phoneNumber)
    .maybeSingle();

  if (existing) {
    const { error } = await supabase.from("contacts").update(patch).eq("id", existing.id);
    if (error) throw error;
  } else {
    const { error } = await supabase.from("contacts").insert(patch);
    if (error) throw error;
  }

  const { data } = await supabase
    .from("contacts")
    .select("*")
    .eq("phone_number", input.phoneNumber)
    .maybeSingle();
  return data;
}

export async function getContact(supabase: SupabaseClient, phoneNumber: string) {
  const { data } = await supabase
    .from("contacts")
    .select("*")
    .eq("phone_number", phoneNumber)
    .maybeSingle();
  return data;
}