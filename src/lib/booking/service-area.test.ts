import { describe, expect, it } from "vitest";

import { decideServiceArea } from "./service-area";

const tulsa = { lat: 36.154, lng: -95.9928, postalCode: "74103" };
const okc = { lat: 35.4676, lng: -97.5164, postalCode: "73102" };

describe("decideServiceArea", () => {
  it("rejects an address outside the radius and accepts one inside", () => {
    const area = {
      mode: "radius" as const,
      radiusMiles: 30,
      center: { lat: tulsa.lat, lng: tulsa.lng },
    };
    expect(decideServiceArea(area, tulsa).ok).toBe(true);
    const outside = decideServiceArea(area, okc);
    expect(outside.ok).toBe(false);
    if (!outside.ok) expect(outside.reason).toMatch(/outside the 30-mile service area/i);
  });

  it("rejects a ZIP that is not on the line's list", () => {
    const area = { mode: "zips" as const, zips: ["74103", "74104"] };
    expect(decideServiceArea(area, tulsa).ok).toBe(true);
    expect(decideServiceArea(area, okc).ok).toBe(false);
    expect(decideServiceArea(area, null).ok).toBe(false);
  });
});
