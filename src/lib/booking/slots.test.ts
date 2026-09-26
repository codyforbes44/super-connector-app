import { describe, expect, it } from "vitest";

import { findOpenSlots, slotOverlapsBusy } from "./slots";

const hours = { start: "09:00", end: "12:00", days: [1, 2, 3, 4, 5] };
const zone = "America/Chicago";

/** Monday 26 Sep 2026, 08:00 Chicago (13:00 UTC). */
const now = new Date("2026-09-26T13:00:00.000Z");

describe("findOpenSlots", () => {
  it("spaces slots by the buffer and keeps them inside hours", () => {
    const slots = findOpenSlots({
      busy: [],
      now,
      slotMinutes: 30,
      bufferMinutes: 30,
      travelMinutes: 0,
      hours,
      timeZone: zone,
      days: 3,
      limit: 8,
    });
    expect(slots.map((slot) => slot.start)).toEqual([
      "2026-09-28T14:00:00.000Z",
      "2026-09-28T15:00:00.000Z",
      "2026-09-28T16:00:00.000Z",
    ]);
    expect(slots[0]?.end).toBe("2026-09-28T14:30:00.000Z");
  });

  it("rejects a booked slot and the travel window around it", () => {
    const busy = [{ start: "2026-09-28T15:00:00.000Z", end: "2026-09-28T16:00:00.000Z" }];
    const slots = findOpenSlots({
      busy,
      now,
      slotMinutes: 30,
      bufferMinutes: 0,
      travelMinutes: 30,
      hours,
      timeZone: zone,
      days: 3,
      limit: 8,
    });
    const starts = slots.map((slot) => slot.start);
    expect(starts).toContain("2026-09-28T14:00:00.000Z");
    expect(starts).not.toContain("2026-09-28T14:30:00.000Z");
    expect(starts).not.toContain("2026-09-28T15:00:00.000Z");
    expect(starts).not.toContain("2026-09-28T15:30:00.000Z");
    expect(starts).not.toContain("2026-09-28T16:00:00.000Z");
    expect(starts).toContain("2026-09-28T16:30:00.000Z");
    expect(
      slotOverlapsBusy(
        { start: "2026-09-28T15:00:00.000Z", end: "2026-09-28T15:30:00.000Z" },
        busy,
        30,
      ),
    ).toBe(true);
  });
});
