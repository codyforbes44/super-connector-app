import { describe, expect, it } from "vitest";
import { numberHealth } from "./number-health";

const now = Date.parse("2026-11-20T00:00:00Z");
const n = (wired = true) => [{ number: "+15550000001", label: "", wired }];

describe("number health", () => {
  it("flags a number not set up for SixVox", () => {
    expect(numberHealth(n(false), [], [], now)[0]!.status).toBe("not_connected");
  });
  it("flags three or more errors in a week", () => {
    const act = [{ from: "+1", to: "+15550000001", at: "2026-11-19T00:00:00Z" }];
    expect(numberHealth(n(), act, ["+15550000001", "+15550000001", "+15550000001"], now)[0]!.status).toBe("attention");
  });
  it("flags 14 days without activity", () => {
    const act = [{ from: "+1", to: "+15550000001", at: "2026-11-01T00:00:00Z" }];
    expect(numberHealth(n(), act, [], now)[0]!.status).toBe("attention");
  });
  it("reports healthy with recent activity and few errors", () => {
    const act = [{ from: "+15550000001", to: "+1", at: "2026-11-18T00:00:00Z" }];
    const r = numberHealth(n(), act, ["+15550000001"], now)[0]!;
    expect(r.status).toBe("healthy");
    expect(r.lastActivity).toBe("2026-11-18T00:00:00Z");
  });
});
