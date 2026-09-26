import { describe, expect, it } from "vitest";

import { formatPhone, toE164 } from "./format";

describe("phone formatting", () => {
  it("formats a US number for the dialer", () => {
    expect(formatPhone("+15555550199")).toBe("(555) 555-0199");
    expect(formatPhone("5555550199")).toBe("(555) 555-0199");
  });

  it("builds an E.164 value the voice webhook can dial", () => {
    expect(toE164("(555) 555-0199")).toBe("+15555550199");
    expect(toE164("123")).toBeNull();
  });
});
