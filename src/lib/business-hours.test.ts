import { describe, expect, it } from "vitest";

import { DEFAULT_WEEKLY_SCHEDULE, isOpenAt, routeForHours } from "./business-hours";

const base = {
  enabled: true,
  timeZone: "America/Chicago",
  schedule: DEFAULT_WEEKLY_SCHEDULE,
  holidays: [] as string[],
  afterHours: "ai" as const,
};

describe("business hours routing", () => {
  it("keeps today's routing during open hours", () => {
    const mondayMorning = new Date("2026-09-28T15:00:00.000Z");
    expect(routeForHours({ ...base, now: mondayMorning })).toBe("as_today");
    expect(isOpenAt({ ...base, now: mondayMorning })).toBe(true);
  });

  it("sends after-hours calls to the AI or to voicemail", () => {
    const mondayEvening = new Date("2026-09-28T23:30:00.000Z");
    expect(routeForHours({ ...base, now: mondayEvening })).toBe("after_hours_ai");
    expect(routeForHours({ ...base, afterHours: "voicemail", now: mondayEvening })).toBe(
      "after_hours_voicemail",
    );
  });

  it("treats weekends and holiday dates as closed", () => {
    const saturday = new Date("2026-09-26T15:00:00.000Z");
    expect(routeForHours({ ...base, now: saturday })).toBe("after_hours_ai");
    const holidayMonday = new Date("2026-09-28T15:00:00.000Z");
    expect(routeForHours({ ...base, holidays: ["2026-09-28"], now: holidayMonday })).toBe(
      "after_hours_ai",
    );
  });

  it("leaves routing unchanged when hours are off or the timezone is invalid", () => {
    const evening = new Date("2026-09-28T23:30:00.000Z");
    expect(routeForHours({ ...base, enabled: false, now: evening })).toBe("as_today");
    expect(routeForHours({ ...base, timeZone: "Not/AZone", now: evening })).toBe("as_today");
  });

  it("wraps an overnight window", () => {
    const schedule = {
      ...DEFAULT_WEEKLY_SCHEDULE,
      mon: [{ open: "18:00", close: "02:00" }],
    };
    const late = new Date("2026-09-29T04:30:00.000Z");
    expect(isOpenAt({ ...base, schedule, now: late })).toBe(true);
    const midday = new Date("2026-09-28T17:00:00.000Z");
    expect(isOpenAt({ ...base, schedule, now: midday })).toBe(false);
  });
});
