import { describe, expect, it } from "vitest";

import { mobilePresenceIdentity } from "./mobile-presence";
import { voiceIdentityFor } from "./voice-token.server";

describe("mobilePresenceIdentity", () => {
  it("keeps the Twilio identity as a prefix and does not replace it", () => {
    const userId = "11111111-2222-3333-4444-555555555555";
    const identity = mobilePresenceIdentity(userId, "ios", "phone-1");
    expect(identity.startsWith(`${voiceIdentityFor(userId)}#ios#`)).toBe(true);
    expect(identity).not.toBe(voiceIdentityFor(userId));
  });

  it("strips characters that would not round-trip in a row key", () => {
    const identity = mobilePresenceIdentity("user_1", "android", "abc def/../x");
    expect(identity.endsWith("#android#abcdefx")).toBe(true);
  });

  it("rejects an empty device id", () => {
    expect(() => mobilePresenceIdentity("user_1", "ios", "///")).toThrow(/device id/i);
  });
});
