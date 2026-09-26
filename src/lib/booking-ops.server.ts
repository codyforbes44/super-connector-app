import type { SupabaseClient } from "@supabase/supabase-js";

import { emitAppEvent } from "./app-events";
import { wireAppEventWebhooks } from "./app-events-webhooks.server";
import { sendLineSms } from "./line-sms.server";

wireAppEventWebhooks();
import {
  bookingSpokenLine,
  resolveAnsweringLanguage,
  smsTemplate,
  type SpokenLanguage,
} from "./answering/language";
import { decideServiceArea, type ServiceArea } from "./booking/service-area";
import {
  findOpenSlots,
  slotOverlapsBusy,
  type BookingHours,
  type TimeRange,
} from "./booking/slots";
import { parseBookingReply } from "./booking/replies";
import { campaignApproved } from "./messaging.server";
import { normalizePhone } from "./twilio.server";

export type ConfirmMode = "confirm" | "automatic";

export type LineBooking = {
  phoneNumber: string;
  sid: string;
  assignedTo: string | null;
  workspaceId: string | null;
  calendarId: string;
  enabled: boolean;
  slotMinutes: number;
  bufferMinutes: number;
  travelMinutes: number;
  timezone: string;
  hours: BookingHours;
  confirmMode: ConfirmMode;
  serviceArea: ServiceArea;
  messagingServiceSid: string | null;
  campaignStatus: string | null;
  language: string;
};

export function textingReady(line: {
  messagingServiceSid: string | null;
  campaignStatus: string | null;
}): boolean {
  return Boolean(line.messagingServiceSid) && campaignApproved(line.campaignStatus);
}

export function bookingFromRow(row: Record<string, unknown> | null): LineBooking | null {
  if (!row) return null;
  const hours = (row["booking_hours"] as BookingHours | null) ?? {
    start: "09:00",
    end: "17:00",
    days: [1, 2, 3, 4, 5],
  };
  const mode =
    row["service_area_mode"] === "radius" || row["service_area_mode"] === "zips"
      ? row["service_area_mode"]
      : "off";
  const lat = row["service_area_lat"] as number | null;
  const lng = row["service_area_lng"] as number | null;
  return {
    phoneNumber: String(row["phone_number"] ?? ""),
    sid: String(row["sid"] ?? ""),
    assignedTo: (row["assigned_to"] as string | null) ?? null,
    workspaceId: (row["workspace_id"] as string | null) ?? null,
    calendarId: (row["calendar_id"] as string | null) || "primary",
    enabled: Boolean(row["booking_enabled"]),
    slotMinutes: Number(row["booking_slot_minutes"] ?? 30),
    bufferMinutes: Number(row["booking_buffer_minutes"] ?? 0),
    travelMinutes: Number(row["booking_travel_minutes"] ?? 0),
    timezone: (row["booking_timezone"] as string) || "America/Chicago",
    hours,
    confirmMode: row["booking_confirm_mode"] === "automatic" ? "automatic" : "confirm",
    serviceArea: {
      mode,
      radiusMiles: (row["service_area_radius_miles"] as number | null) ?? null,
      center: lat != null && lng != null ? { lat, lng } : null,
      zips: (row["service_area_zips"] as string[] | null) ?? [],
    },
    messagingServiceSid: (row["messaging_service_sid"] as string | null) ?? null,
    campaignStatus: (row["campaign_status"] as string | null) ?? null,
    language: (row["ai_language"] as string) || "en",
  };
}

const BOOKING_SELECT =
  "phone_number, sid, assigned_to, workspace_id, calendar_id, booking_enabled, booking_slot_minutes, booking_buffer_minutes, booking_travel_minutes, booking_timezone, booking_hours, booking_confirm_mode, service_area_mode, service_area_radius_miles, service_area_lat, service_area_lng, service_area_address, service_area_zips, messaging_service_sid, campaign_status, ai_language";

export async function loadLineBooking(
  admin: SupabaseClient,
  appNumber: string,
): Promise<LineBooking | null> {
  const { data } = await admin
    .from("phone_numbers")
    .select(BOOKING_SELECT)
    .eq("phone_number", appNumber)
    .maybeSingle();
  return bookingFromRow(data as Record<string, unknown> | null);
}

async function busyRanges(calendarId: string): Promise<TimeRange[]> {
  const gcal = await import("./gcal.server");
  if (!gcal.calendarConfigured()) return [];
  const now = new Date();
  const horizon = new Date(now.getTime() + 7 * 86_400_000);
  const busy = await gcal.freeBusy({
    calendarId,
    timeMin: now.toISOString(),
    timeMax: horizon.toISOString(),
  });
  return busy.map((block) => ({ start: block.start, end: block.end }));
}

function openSlots(line: LineBooking, busy: TimeRange[]) {
  return findOpenSlots({
    busy,
    now: new Date(),
    slotMinutes: line.slotMinutes,
    bufferMinutes: line.bufferMinutes,
    travelMinutes: line.travelMinutes,
    hours: line.hours,
    timeZone: line.timezone,
  });
}

async function geocodeAddress(address: string) {
  const maps = await import("./maps.server");
  if (!maps.mapsConfigured()) return null;
  return maps.geocode(address);
}

export type ToolReply = {
  ok: boolean;
  language: SpokenLanguage;
  message: string;
  slots?: TimeRange[];
  booking_id?: string;
  texting?: "ready" | "not_registered" | "skipped";
};

function languageFor(line: LineBooking, utterance: string): SpokenLanguage {
  return resolveAnsweringLanguage(line.language, utterance);
}

export async function toolCheckAvailability(
  admin: SupabaseClient,
  args: { called_number?: string; utterance?: string },
): Promise<ToolReply> {
  const line = await loadLineBooking(admin, String(args.called_number ?? ""));
  const language = languageFor(line ?? ({ language: "en" } as LineBooking), args.utterance ?? "");
  if (!line?.enabled) {
    return {
      ok: false,
      language,
      message:
        language === "es"
          ? "Las reservas no están activadas en esta línea."
          : "Booking is not turned on for this line.",
    };
  }
  const slots = openSlots(line, await busyRanges(line.calendarId));
  return {
    ok: true,
    language,
    slots,
    message:
      language === "es"
        ? `Horarios libres: ${
            slots
              .map((slot) => slot.start)
              .slice(0, 5)
              .join(", ") || "ninguno"
          }.`
        : `Open times: ${
            slots
              .map((slot) => slot.start)
              .slice(0, 5)
              .join(", ") || "none"
          }.`,
  };
}

export async function toolCheckServiceArea(
  admin: SupabaseClient,
  args: { called_number?: string; address?: string; utterance?: string },
): Promise<ToolReply> {
  const line = await loadLineBooking(admin, String(args.called_number ?? ""));
  const language = languageFor(
    line ?? ({ language: "en" } as LineBooking),
    `${args.utterance ?? ""} ${args.address ?? ""}`,
  );
  if (!line) return { ok: false, language, message: "Unknown line." };
  const place = args.address ? await geocodeAddress(args.address) : null;
  const decision = decideServiceArea(
    line.serviceArea,
    place ? { lat: place.lat, lng: place.lng, postalCode: place.postalCode ?? null } : null,
  );
  return {
    ok: decision.ok,
    language,
    message: decision.ok ? decision.reason : bookingSpokenLine("rejected_area", language),
  };
}

export async function toolProposeBooking(
  admin: SupabaseClient,
  args: {
    called_number?: string;
    caller_number?: string;
    call_sid?: string;
    slot_start?: string;
    slot_end?: string;
    address?: string;
    customer_name?: string;
    job_type?: string;
    summary?: string;
    utterance?: string;
  },
): Promise<ToolReply> {
  const line = await loadLineBooking(admin, String(args.called_number ?? ""));
  const utterance = `${args.utterance ?? ""} ${args.address ?? ""} ${args.customer_name ?? ""}`;
  const language = languageFor(line ?? ({ language: "en" } as LineBooking), utterance);
  if (!line?.enabled) {
    return {
      ok: false,
      language,
      message: language === "es" ? "Las reservas no están activadas." : "Booking is not turned on.",
    };
  }
  if (!args.slot_start || !args.slot_end) {
    const slots = openSlots(line, await busyRanges(line.calendarId));
    return {
      ok: false,
      language,
      slots,
      message: language === "es" ? "Falta el horario." : "A start and end time are required.",
    };
  }

  const place = args.address ? await geocodeAddress(args.address) : null;
  if (line.serviceArea.mode !== "off" && !args.address) {
    return {
      ok: false,
      language,
      message:
        language === "es"
          ? "Necesito la dirección del trabajo."
          : "I need the service address before I can book.",
    };
  }
  const area = decideServiceArea(
    line.serviceArea,
    place ? { lat: place.lat, lng: place.lng, postalCode: place.postalCode ?? null } : null,
  );
  if (line.serviceArea.mode !== "off" && !area.ok) {
    return { ok: false, language, message: bookingSpokenLine("rejected_area", language) };
  }

  const slot = { start: args.slot_start, end: args.slot_end };
  const busy = await busyRanges(line.calendarId);
  if (slotOverlapsBusy(slot, busy, line.travelMinutes)) {
    return {
      ok: false,
      language,
      slots: openSlots(line, busy),
      message: bookingSpokenLine("rejected_busy", language),
    };
  }

  const summary = args.summary || args.job_type || (language === "es" ? "Trabajo" : "Job");
  const contact = args.caller_number ? normalizePhone(args.caller_number) : null;
  const automatic = line.confirmMode === "automatic";

  const { data: proposal, error } = await admin
    .from("booking_proposals")
    .insert({
      workspace_id: line.workspaceId,
      user_id: line.assignedTo,
      app_number: line.phoneNumber,
      call_sid: args.call_sid ?? null,
      contact_number: contact,
      contact_name: args.customer_name ?? null,
      address: place?.formatted ?? args.address ?? null,
      address_lat: place?.lat ?? null,
      address_lng: place?.lng ?? null,
      place_id: place?.placeId ?? null,
      postal_code: place?.postalCode ?? null,
      in_service_area: area.ok,
      job_type: args.job_type ?? null,
      summary,
      language,
      slot_start: slot.start,
      slot_end: slot.end,
      status: "proposed",
      confirm_mode: line.confirmMode,
    })
    .select("id")
    .single();
  if (error || !proposal) {
    return {
      ok: false,
      language,
      message: language === "es" ? "No pude guardar la reserva." : "I couldn't save that booking.",
    };
  }

  const bookingId = proposal.id as string;
  if (!automatic) {
    const { notifyNumberWatchers } = await import("./push.server");
    await notifyNumberWatchers(admin, line.phoneNumber, {
      title: "Approve a booking",
      body: `${args.customer_name || contact || "A caller"} · ${summary}`,
      url: "/calls",
      tag: `booking-${bookingId}`,
      type: "message",
    });
    return {
      ok: true,
      language,
      booking_id: bookingId,
      message: bookingSpokenLine("proposed", language, { when: slot.start }),
    };
  }

  const booked = await confirmProposal(admin, bookingId, { actorId: line.assignedTo });
  return {
    ok: booked.ok,
    language,
    booking_id: bookingId,
    texting: booked.texting,
    message: booked.ok
      ? bookingSpokenLine("booked", language, { when: slot.start })
      : booked.message,
  };
}

async function sendConfirmation(
  admin: SupabaseClient,
  line: LineBooking,
  to: string | null,
  body: string,
): Promise<"ready" | "not_registered" | "skipped"> {
  if (!to) return "skipped";
  if (!textingReady(line)) return "not_registered";
  const sent = await sendLineSms(admin, {
    appNumber: line.phoneNumber,
    to,
    body,
    messagingServiceSid: line.messagingServiceSid,
  });
  if (sent.sent) return "ready";
  if (sent.reason === "not_registered") return "not_registered";
  return "skipped";
}

export async function confirmProposal(
  admin: SupabaseClient,
  proposalId: string,
  opts: { actorId?: string | null },
): Promise<{ ok: boolean; message: string; texting: "ready" | "not_registered" | "skipped" }> {
  const { data: row } = await admin
    .from("booking_proposals")
    .select("*")
    .eq("id", proposalId)
    .maybeSingle();
  if (!row) return { ok: false, message: "Booking not found.", texting: "skipped" };
  const proposal = row as Record<string, unknown>;
  if (proposal["status"] === "cancelled" || proposal["status"] === "declined") {
    return { ok: false, message: "That booking is already closed.", texting: "skipped" };
  }
  if (proposal["status"] === "approved" && proposal["calendar_event_id"]) {
    return { ok: true, message: "Already booked.", texting: "skipped" };
  }
  const line = await loadLineBooking(admin, String(proposal["app_number"]));
  if (!line) return { ok: false, message: "Line not found.", texting: "skipped" };

  const slot = { start: String(proposal["slot_start"]), end: String(proposal["slot_end"]) };
  const busy = await busyRanges(line.calendarId);
  if (!proposal["calendar_event_id"] && slotOverlapsBusy(slot, busy, line.travelMinutes)) {
    return { ok: false, message: "That time was just booked.", texting: "skipped" };
  }

  let eventId = (proposal["calendar_event_id"] as string | null) ?? null;
  let htmlLink: string | null = null;
  if (!eventId) {
    const gcal = await import("./gcal.server");
    if (!gcal.calendarConfigured()) {
      return {
        ok: false,
        message: "Google Calendar isn't connected, so this slot wasn't booked.",
        texting: "skipped",
      };
    }
    const location = (proposal["address"] as string | null) ?? "";
    let event: Awaited<ReturnType<typeof gcal.createEvent>>;
    try {
      event = await gcal.createEvent({
        calendarId: line.calendarId,
        summary: String(proposal["summary"] ?? "Job"),
        description: [proposal["contact_name"], proposal["contact_number"], proposal["address"]]
          .filter(Boolean)
          .join("\n"),
        start: slot.start,
        end: slot.end,
        timeZone: line.timezone,
        ...(location ? { location } : {}),
      });
    } catch (error) {
      console.error("calendar create failed", error);
      return { ok: false, message: "Google Calendar couldn't save that time.", texting: "skipped" };
    }
    eventId = event.id;
    htmlLink = event.htmlLink ?? null;
    await admin.from("calendar_bookings").insert({
      event_id: event.id,
      calendar_id: line.calendarId,
      app_number: line.phoneNumber,
      contact_number: proposal["contact_number"],
      summary: event.summary,
      html_link: htmlLink,
      starts_at: slot.start,
      ends_at: slot.end,
      source: "ai",
      call_sid: proposal["call_sid"],
      created_by: opts.actorId ?? line.assignedTo,
      workspace_id: line.workspaceId,
      proposal_id: proposalId,
      status: "confirmed",
    });
  }

  const language = (proposal["language"] === "es" ? "es" : "en") as SpokenLanguage;
  const sms = smsTemplate("confirmed", language, {
    job: String(proposal["job_type"] ?? proposal["summary"] ?? ""),
    when: slot.start,
    address: String(proposal["address"] ?? ""),
    name: String(proposal["contact_name"] ?? ""),
  });
  const texting = await sendConfirmation(
    admin,
    line,
    (proposal["contact_number"] as string | null) ?? null,
    sms,
  );

  await admin
    .from("booking_proposals")
    .update({
      status: "approved",
      calendar_event_id: eventId,
      sms_status:
        texting === "not_registered" ? "not_registered" : texting === "ready" ? "sent" : null,
    })
    .eq("id", proposalId);

  const { data: booking } = await admin
    .from("calendar_bookings")
    .select("id")
    .eq("proposal_id", proposalId)
    .maybeSingle();

  await emitAppEvent({
    type: "booking.created",
    payload: {
      bookingId: (booking?.id as string | undefined) ?? proposalId,
      appNumber: line.phoneNumber,
      contactNumber: (proposal["contact_number"] as string | null) ?? null,
      startsAt: slot.start,
      endsAt: slot.end,
      summary: String(proposal["summary"] ?? "Job"),
      workspaceId: line.workspaceId,
      callSid: (proposal["call_sid"] as string | null) ?? null,
    },
  });

  return {
    ok: true,
    texting,
    message:
      texting === "not_registered"
        ? smsTemplate("not_registered", language)
        : bookingSpokenLine("booked", language, { when: slot.start }),
  };
}

export async function declineProposal(
  admin: SupabaseClient,
  proposalId: string,
): Promise<{ ok: true }> {
  await admin.from("booking_proposals").update({ status: "declined" }).eq("id", proposalId);
  return { ok: true };
}

export async function handleBookingReply(
  admin: SupabaseClient,
  input: { appNumber: string; contactNumber: string; body: string },
): Promise<{ handled: boolean }> {
  const intent = parseBookingReply(input.body);
  if (intent === "unknown") return { handled: false };

  const contact = normalizePhone(input.contactNumber);
  const { data } = await admin
    .from("booking_proposals")
    .select("*")
    .eq("app_number", input.appNumber)
    .eq("contact_number", contact)
    .in("status", ["proposed", "approved", "reschedule_requested"])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!data) return { handled: false };
  const proposal = data as Record<string, unknown>;
  const line = await loadLineBooking(admin, input.appNumber);
  const language = (proposal["language"] === "es" ? "es" : "en") as SpokenLanguage;

  if (intent === "confirm" && proposal["status"] === "proposed") {
    await admin
      .from("booking_proposals")
      .update({ customer_reply: "confirm" })
      .eq("id", proposal["id"] as string);
    return { handled: true };
  }
  if (intent === "confirm") return { handled: true };

  if (intent === "cancel") {
    const eventId = proposal["calendar_event_id"] as string | null;
    if (eventId && line) {
      try {
        const gcal = await import("./gcal.server");
        await gcal.deleteEvent(line.calendarId, eventId);
      } catch (error) {
        console.error("calendar cancel failed", error);
      }
      await admin
        .from("calendar_bookings")
        .update({ status: "cancelled" })
        .eq("proposal_id", proposal["id"] as string);
    }
    await admin
      .from("booking_proposals")
      .update({ status: "cancelled", customer_reply: "cancel" })
      .eq("id", proposal["id"] as string);
    if (line) {
      await sendConfirmation(admin, line, contact, smsTemplate("cancelled", language));
    }
    return { handled: true };
  }

  await admin
    .from("booking_proposals")
    .update({ status: "reschedule_requested", customer_reply: "reschedule" })
    .eq("id", proposal["id"] as string);
  if (line) {
    const { notifyNumberWatchers } = await import("./push.server");
    await notifyNumberWatchers(admin, line.phoneNumber, {
      title: "Reschedule requested",
      body: `${contact} wants a different time`,
      url: "/calls",
      tag: `booking-${proposal["id"] as string}`,
      type: "message",
    });
    await sendConfirmation(admin, line, contact, smsTemplate("reschedule", language));
  }
  return { handled: true };
}

export async function toolCaptureLead(
  admin: SupabaseClient,
  args: {
    called_number?: string;
    caller_number?: string;
    call_sid?: string;
    customer_name?: string;
    callback_number?: string;
    address?: string;
    job_type?: string;
    urgency?: string;
    utterance?: string;
  },
): Promise<ToolReply> {
  const { stampStructuredLead } = await import("./lead-fields.server");
  const line = await loadLineBooking(admin, String(args.called_number ?? ""));
  const language = languageFor(
    line ?? ({ language: "en" } as LineBooking),
    args.utterance ?? args.address ?? "",
  );
  if (!line || !args.call_sid) {
    return {
      ok: false,
      language,
      message: language === "es" ? "No pude guardar el encargo." : "I couldn't save the lead.",
    };
  }
  await stampStructuredLead(admin, {
    callSid: args.call_sid,
    appNumber: line.phoneNumber,
    contactNumber: args.caller_number ?? null,
    userId: line.assignedTo,
    workspaceId: line.workspaceId,
    transcript: [
      args.customer_name ? `My name is ${args.customer_name}.` : "",
      args.callback_number ? `Call me at ${args.callback_number}.` : "",
      args.address ? `The address is ${args.address}.` : "",
      args.job_type ? `Job: ${args.job_type}.` : "",
      args.urgency === "high" ? "This is an emergency." : "",
      args.utterance ?? "",
    ]
      .filter(Boolean)
      .join(" "),
    overrides: {
      name: args.customer_name ?? null,
      callbackNumber: args.callback_number ?? null,
      address: args.address ?? null,
      jobType: args.job_type ?? null,
      ...(args.urgency === "high" || args.urgency === "low" || args.urgency === "normal"
        ? { urgency: args.urgency }
        : {}),
    },
  });
  return {
    ok: true,
    language,
    message: language === "es" ? "Guardé los datos del trabajo." : "Saved the job details.",
  };
}
