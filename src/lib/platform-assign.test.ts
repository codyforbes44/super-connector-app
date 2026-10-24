import { describe, expect, it } from "vitest";

import { assertAssignable, parseRole } from "./platform-assign";

describe("platform number assignment rules", () => {
  it("refuses to move the locked AI concierge line", () => {
    expect(() => assertAssignable("+18175338844")).toThrow(/locked/);
  });
  it("allows a normal number like Jagar's", () => {
    expect(() => assertAssignable("+18175089595")).not.toThrow();
  });
  it("only accepts owner, admin or agent roles", () => {
    expect(parseRole("agent")).toBe("agent");
    expect(() => parseRole("super_admin")).toThrow();
  });
});
