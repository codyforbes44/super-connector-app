/**
 * Per-line weekly hours, holidays, and the after-hours routing decision.
 * Pure: the voice webhook passes `now` so tests can pin a clock.
 */

export const DAY_KEYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"] as const;
export type DayKey = (typeof DAY_KEYS)[number];

export type HoursWindow = { open: string; close: string };
export type WeeklySchedule = Record<DayKey, HoursWindow[]>;

export const DEFAULT_BUSINESS_TIMEZONE = "America/Chicago";

export const DEFAULT_WEEKLY_SCHEDULE: WeeklySchedule = {
  sun: [],
  mon: [{ open: "08:00", close: "17:00" }],
  tue: [{ open: "08:00", close: "17:00" }],
  wed: [{ open: "08:00", close: "17:00" }],
  thu: [{ open: "08:00", close: "17:00" }],
  fri: [{ open: "08:00", close: "17:00" }],
  sat: [],
};

export type AfterHoursDestination = "ai" | "voicemail";

/** `as_today` keeps the line's current voice TwiML, including the ElevenLabs redirect. */
export type HoursRoute = "as_today" | "after_hours_ai" | "after_hours_voicemail";

const WEEKDAY_TO_KEY: Record<string, DayKey> = {
  Sun: "sun",
  Mon: "mon",
  Tue: "tue",
  Wed: "wed",
  Thu: "thu",
  Fri: "fri",
  Sat: "sat",
};

function emptySchedule(): WeeklySchedule {
  return { sun: [], mon: [], tue: [], wed: [], thu: [], fri: [], sat: [] };
}

function parseClock(value: string): number | null {
  const match = /^(\d{1,2}):(\d{2})$/.exec(value.trim());
  if (!match) return null;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (hour > 23 || minute > 59) return null;
  return hour * 60 + minute;
}

function parseWindow(value: unknown): HoursWindow | null {
  if (!value || typeof value !== "object") return null;
  const open = "open" in value && typeof value.open === "string" ? value.open : "";
  const close = "close" in value && typeof value.close === "string" ? value.close : "";
  if (parseClock(open) === null || parseClock(close) === null) return null;
  return { open, close };
}

export function parseWeeklySchedule(value: unknown): WeeklySchedule {
  const schedule = emptySchedule();
  if (!value || typeof value !== "object") return { ...DEFAULT_WEEKLY_SCHEDULE };
  const record = value as Record<string, unknown>;
  let sawDay = false;
  for (const day of DAY_KEYS) {
    const raw = record[day];
    if (raw === undefined) continue;
    sawDay = true;
    const windows = Array.isArray(raw) ? raw : [];
    schedule[day] = windows
      .map(parseWindow)
      .filter((window): window is HoursWindow => window !== null);
  }
  return sawDay ? schedule : { ...DEFAULT_WEEKLY_SCHEDULE };
}

export function parseHolidayDates(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter(
    (item): item is string => typeof item === "string" && /^\d{4}-\d{2}-\d{2}$/.test(item),
  );
}

export function zonedParts(
  now: Date,
  timeZone: string,
): { weekday: DayKey; minutes: number; date: string } | null {
  try {
    const fmt = new Intl.DateTimeFormat("en-US", {
      timeZone,
      weekday: "short",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    });
    const parts = Object.fromEntries(fmt.formatToParts(now).map((part) => [part.type, part.value]));
    const weekday = WEEKDAY_TO_KEY[parts["weekday"] ?? ""];
    if (!weekday) return null;
    let hour = Number(parts["hour"]);
    const minute = Number(parts["minute"]);
    if (hour === 24) hour = 0;
    if (!Number.isFinite(hour) || !Number.isFinite(minute)) return null;
    const year = parts["year"];
    const month = parts["month"];
    const day = parts["day"];
    if (!year || !month || !day) return null;
    return { weekday, minutes: hour * 60 + minute, date: `${year}-${month}-${day}` };
  } catch {
    return null;
  }
}

function windowContains(window: HoursWindow, minutes: number): boolean {
  const open = parseClock(window.open);
  const close = parseClock(window.close);
  if (open === null || close === null || open === close) return false;
  if (open < close) return minutes >= open && minutes < close;
  return minutes >= open || minutes < close;
}

export function isOpenAt(input: {
  enabled: boolean;
  timeZone: string;
  schedule: WeeklySchedule;
  holidays: string[];
  now: Date;
}): boolean {
  if (!input.enabled) return true;
  const zoned = zonedParts(input.now, input.timeZone);
  if (!zoned) return true;
  if (input.holidays.includes(zoned.date)) return false;
  const windows = input.schedule[zoned.weekday] ?? [];
  return windows.some((window) => windowContains(window, zoned.minutes));
}

/**
 * During open hours (or when hours are off) the voice webhook routes exactly as it
 * does today. After hours it goes to the AI receptionist or voicemail.
 */
export function routeForHours(input: {
  enabled: boolean;
  timeZone: string;
  schedule: WeeklySchedule;
  holidays: string[];
  afterHours: AfterHoursDestination;
  now: Date;
}): HoursRoute {
  if (isOpenAt(input)) return "as_today";
  return input.afterHours === "voicemail" ? "after_hours_voicemail" : "after_hours_ai";
}
