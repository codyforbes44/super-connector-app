import { describe, expect, it } from "vitest";
import { assertAiCallCapacity, assertNumberCapacity, assertSeatCapacity, limitsFor } from "./plan-limits";
import { isPlanLimitMessage } from "./toast-error";

const msg = (fn: () => void) => { try { fn(); } catch (e) { return (e as Error).message; } return ""; };

describe("plan limit enforcement", () => {
  it("blocks a second number on Solo and points to Team", () => {
    const m = msg(() => assertNumberCapacity({ limits: limitsFor("solo"), numbersInUse: limitsFor("solo").maxNumbers }));
    expect(m).toMatch(/Upgrade to Team/);
    expect(isPlanLimitMessage(m)).toBe(true);
  });
  it("allows adding while under the number limit", () => {
    expect(msg(() => assertNumberCapacity({ limits: limitsFor("team"), numbersInUse: limitsFor("team").maxNumbers - 1 }))).toBe("");
  });
  it("blocks a seat past the plan's seat count", () => {
    const m = msg(() => assertSeatCapacity({ limits: limitsFor("team"), seatsInUse: limitsFor("team").maxSeats }));
    expect(isPlanLimitMessage(m)).toBe(true);
  });
  it("stops AI answering once included AI calls are used", () => {
    const l = limitsFor("trial");
    const m = msg(() => assertAiCallCapacity({ limits: l, aiCallsUsed: l.includedAiCalls, aiMinutesUsed: 0 }));
    expect(isPlanLimitMessage(m)).toBe(true);
  });
  it("does not treat ordinary errors as plan limits", () => {
    expect(isPlanLimitMessage("Something went wrong.")).toBe(false);
  });
});
