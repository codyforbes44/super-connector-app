/** Free/busy slot search. Pure: callers pass Google Calendar busy ranges in. */

export type TimeRange = { start: string; end: string };

export type BookingHours = { start: string; end: string; days: number[] };

const WEEKDAY: Record<string, number> = {
  Sun: 0,
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
};

export function zonedParts(
  date: Date,
  timeZone: string,
): { year: number; month: number; day: number; hour: number; minute: number; weekday: number } {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    weekday: "short",
    hourCycle: "h23",
  });
  const bag: Record<string, string> = {};
  for (const part of fmt.formatToParts(date)) {
    if (part.type !== "literal") bag[part.type] = part.value;
  }
  return {
    year: Number(bag["year"]),
    month: Number(bag["month"]),
    day: Number(bag["day"]),
    hour: Number(bag["hour"]) % 24,
    minute: Number(bag["minute"]),
    weekday: WEEKDAY[bag["weekday"] ?? ""] ?? 0,
  };
}

/** Wall-clock time in `timeZone` as a UTC instant. */
export function zonedTimeToUtc(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  timeZone: string,
): Date {
  const utcGuess = Date.UTC(year, month - 1, day, hour, minute, 0);
  const wall = (instant: number) => {
    const parts = zonedParts(new Date(instant), timeZone);
    return Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, 0);
  };
  const instant = utcGuess - (wall(utcGuess) - utcGuess);
  const drift = wall(instant) - utcGuess;
  return new Date(instant - drift);
}

function addCalendarDays(year: number, month: number, day: number, days: number) {
  const next = new Date(Date.UTC(year, month - 1, day + days));
  return { year: next.getUTCFullYear(), month: next.getUTCMonth() + 1, day: next.getUTCDate() };
}

function parseHm(value: string, fallbackHour: number, fallbackMinute: number): [number, number] {
  const [h, m] = (value || "").split(":").map(Number);
  return [Number.isFinite(h) ? h! : fallbackHour, Number.isFinite(m) ? m! : fallbackMinute];
}

/** True when the slot overlaps a busy range expanded by travel time on both sides. */
export function slotOverlapsBusy(slot: TimeRange, busy: TimeRange[], travelMinutes = 0): boolean {
  const travelMs = Math.max(0, travelMinutes) * 60_000;
  const start = new Date(slot.start).getTime();
  const end = new Date(slot.end).getTime();
  return busy.some((block) => {
    const blockStart = new Date(block.start).getTime() - travelMs;
    const blockEnd = new Date(block.end).getTime() + travelMs;
    return blockStart < end && blockEnd > start;
  });
}

/**
 * Open slots inside bookable hours.
 * `bufferMinutes` is the gap between offered slots.
 * `travelMinutes` pads every busy event so the owner can drive between jobs.
 */
export function findOpenSlots(opts: {
  busy: TimeRange[];
  now: Date;
  slotMinutes: number;
  bufferMinutes?: number;
  travelMinutes?: number;
  hours: BookingHours;
  timeZone: string;
  days?: number;
  limit?: number;
}): TimeRange[] {
  const slotMs = Math.max(5, opts.slotMinutes) * 60_000;
  const stepMs = slotMs + Math.max(0, opts.bufferMinutes ?? 0) * 60_000;
  const travelMinutes = Math.max(0, opts.travelMinutes ?? 0);
  const horizon = opts.days ?? 7;
  const limit = opts.limit ?? 12;
  const [startHour, startMinute] = parseHm(opts.hours.start, 9, 0);
  const [endHour, endMinute] = parseHm(opts.hours.end, 17, 0);
  const openDays = opts.hours.days?.length ? opts.hours.days : [1, 2, 3, 4, 5];
  const today = zonedParts(opts.now, opts.timeZone);
  const earliest = opts.now.getTime() + 15 * 60_000;
  const out: TimeRange[] = [];

  for (let dayOffset = 0; dayOffset < horizon && out.length < limit; dayOffset += 1) {
    const date = addCalendarDays(today.year, today.month, today.day, dayOffset);
    const noon = zonedTimeToUtc(date.year, date.month, date.day, 12, 0, opts.timeZone);
    if (!openDays.includes(zonedParts(noon, opts.timeZone).weekday)) continue;
    const dayStart = zonedTimeToUtc(
      date.year,
      date.month,
      date.day,
      startHour,
      startMinute,
      opts.timeZone,
    ).getTime();
    const dayEnd = zonedTimeToUtc(
      date.year,
      date.month,
      date.day,
      endHour,
      endMinute,
      opts.timeZone,
    ).getTime();

    for (
      let t = Math.max(dayStart, earliest);
      t + slotMs <= dayEnd && out.length < limit;
      t += stepMs
    ) {
      const slot = { start: new Date(t).toISOString(), end: new Date(t + slotMs).toISOString() };
      if (!slotOverlapsBusy(slot, opts.busy, travelMinutes)) out.push(slot);
    }
  }

  return out;
}
