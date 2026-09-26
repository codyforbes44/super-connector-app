import { findOpenSlots, type BookingHours } from "./booking/slots";
import { connectorConfigured, gatewayRequest } from "./connectors.server";

const BASE = "/calendar/v3";

export function calendarConfigured(): boolean {
  return connectorConfigured("google_calendar");
}

export type CalendarSummary = { id: string; summary: string; primary: boolean; timeZone?: string };

export type CalendarEvent = {
  id: string;
  summary: string;
  description?: string;
  start: string;
  end: string;
  htmlLink?: string;
  attendees: string[];
  location?: string;
};

type RawEvent = {
  id: string;
  summary?: string;
  description?: string;
  htmlLink?: string;
  location?: string;
  start?: { dateTime?: string; date?: string };
  end?: { dateTime?: string; date?: string };
  attendees?: Array<{ email?: string }>;
};

function normalize(e: RawEvent): CalendarEvent {
  return {
    id: e.id,
    summary: e.summary ?? "(no title)",
    ...(e.description ? { description: e.description } : {}),
    start: e.start?.dateTime ?? e.start?.date ?? "",
    end: e.end?.dateTime ?? e.end?.date ?? "",
    ...(e.htmlLink ? { htmlLink: e.htmlLink } : {}),
    ...(e.location ? { location: e.location } : {}),
    attendees: (e.attendees ?? []).map((a) => a.email ?? "").filter(Boolean),
  };
}

export async function listCalendars(): Promise<CalendarSummary[]> {
  const res = await gatewayRequest<{
    items?: Array<{ id: string; summary: string; primary?: boolean; timeZone?: string }>;
  }>({ connector: "google_calendar", path: `${BASE}/users/me/calendarList` });
  return (res.items ?? []).map((c) => ({
    id: c.id,
    summary: c.summary,
    primary: Boolean(c.primary),
    ...(c.timeZone ? { timeZone: c.timeZone } : {}),
  }));
}

export async function listEvents(opts: {
  calendarId?: string;
  timeMin?: string;
  timeMax?: string;
  max?: number;
  q?: string;
}): Promise<CalendarEvent[]> {
  const calendarId = encodeURIComponent(opts.calendarId || "primary");
  const res = await gatewayRequest<{ items?: RawEvent[] }>({
    connector: "google_calendar",
    path: `${BASE}/calendars/${calendarId}/events`,
    query: {
      timeMin: opts.timeMin ?? new Date().toISOString(),
      timeMax: opts.timeMax ?? "",
      maxResults: opts.max ?? 20,
      singleEvents: "true",
      orderBy: "startTime",
      q: opts.q ?? "",
    },
  });
  return (res.items ?? []).map(normalize);
}

export async function freeBusy(opts: { calendarId: string; timeMin: string; timeMax: string }) {
  const res = await gatewayRequest<{
    calendars?: Record<string, { busy?: Array<{ start: string; end: string }> }>;
  }>({
    connector: "google_calendar",
    path: `${BASE}/freeBusy`,
    method: "POST",
    json: {
      timeMin: opts.timeMin,
      timeMax: opts.timeMax,
      items: [{ id: opts.calendarId }],
    },
  });
  return res.calendars?.[opts.calendarId]?.busy ?? [];
}

export async function createEvent(opts: {
  calendarId?: string;
  summary: string;
  description?: string;
  start: string;
  end: string;
  timeZone?: string;
  attendees?: string[];
  location?: string;
}): Promise<CalendarEvent> {
  const calendarId = encodeURIComponent(opts.calendarId || "primary");
  const body: Record<string, unknown> = {
    summary: opts.summary,
    start: { dateTime: opts.start, ...(opts.timeZone ? { timeZone: opts.timeZone } : {}) },
    end: { dateTime: opts.end, ...(opts.timeZone ? { timeZone: opts.timeZone } : {}) },
  };
  if (opts.description) body["description"] = opts.description;
  if (opts.location) body["location"] = opts.location;
  const attendees = (opts.attendees ?? []).filter((a) => a.includes("@"));
  if (attendees.length) body["attendees"] = attendees.map((email) => ({ email }));

  const created = await gatewayRequest<RawEvent>({
    connector: "google_calendar",
    path: `${BASE}/calendars/${calendarId}/events`,
    method: "POST",
    json: body,
  });
  return normalize(created);
}

export async function deleteEvent(calendarId: string, eventId: string): Promise<void> {
  await gatewayRequest({
    connector: "google_calendar",
    method: "DELETE",
    path: `${BASE}/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`,
  });
}

export type Slot = { start: string; end: string };

/** Free slots inside the number's bookable hours over the next `days` days. */
export async function availableSlots(opts: {
  calendarId: string;
  slotMinutes: number;
  bufferMinutes?: number;
  travelMinutes?: number;
  hours: BookingHours;
  timeZone: string;
  days?: number;
  limit?: number;
}): Promise<Slot[]> {
  const now = new Date();
  const horizon = new Date(now.getTime() + (opts.days ?? 7) * 86400000);
  const busy = await freeBusy({
    calendarId: opts.calendarId,
    timeMin: now.toISOString(),
    timeMax: horizon.toISOString(),
  });
  return findOpenSlots({
    busy,
    now,
    slotMinutes: opts.slotMinutes,
    hours: opts.hours,
    timeZone: opts.timeZone,
    ...(opts.bufferMinutes !== undefined ? { bufferMinutes: opts.bufferMinutes } : {}),
    ...(opts.travelMinutes !== undefined ? { travelMinutes: opts.travelMinutes } : {}),
    ...(opts.days ? { days: opts.days } : {}),
    ...(opts.limit ? { limit: opts.limit } : {}),
  });
}
