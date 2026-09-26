import { describe, expect, it } from "vitest";

import { assertAiOutboundConsent, latestAiConsent } from "./ai-consent";

describe("outbound AI consent", () => {
  it("uses the newest consent row and blocks a call without it", () => {
    expect(
      latestAiConsent([
        { phoneNumber: "+15125550199", consented: true, recordedAt: "2026-09-01T00:00:00Z" },
        { phoneNumber: "+15125550199", consented: false, recordedAt: "2026-09-20T00:00:00Z" },
      ]),
    ).toBe(false);
    expect(
      latestAiConsent([
        { phoneNumber: "+15125550199", consented: false, recordedAt: "2026-09-01T00:00:00Z" },
        { phoneNumber: "+15125550199", consented: true, recordedAt: "2026-09-20T00:00:00Z" },
      ]),
    ).toBe(true);
    expect(() => assertAiOutboundConsent(false)).toThrow(/prior consent/);
    expect(() => assertAiOutboundConsent(true)).not.toThrow();
  });
});
