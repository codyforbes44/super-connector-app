import { describe, expect, it } from "vitest";
import {
  importableCall,
  importableMessage,
  uniqueProviderRows,
  validateImportConfirmation,
  forwardedCallParent,
  type CarrierCall,
} from "./provider-identity";

describe("provider identity", () => {
  it("keeps one record per SID", () => {
    expect(
      uniqueProviderRows(
        [
          { sid: "a", body: "first" },
          { sid: "a", body: "retry" },
        ],
        (r) => r.sid,
      ),
    ).toEqual([{ sid: "a", body: "first" }]);
  });
  it("does not merge distinct provider calls that look alike", () => {
    expect(
      uniqueProviderRows(
        [
          { sid: "a", name: "same" },
          { sid: "b", name: "same" },
        ],
        (r) => r.sid,
      ),
    ).toHaveLength(2);
  });
  it("never imports empty texts", () => {
    expect(importableMessage({ sid: "a", from: "a", to: "b", body: " ", num_media: "0" })).toBe(
      false,
    );
  });
  it("keeps attachment-only texts", () => {
    expect(importableMessage({ sid: "a", from: "a", to: "b", body: "", num_media: "1" })).toBe(
      true,
    );
  });
  it("does not import internal child call legs", () => {
    expect(importableCall({ sid: "a", from: "a", to: "b", parent_call_sid: "parent" })).toBe(false);
  });
  it("rejects an unconfirmed import", () => {
    expect(() => validateImportConfirmation({})).toThrow("Preview and confirm");
  });
});

describe("forwarded call correlation", () => {
  const inbound: CarrierCall = { sid: "inbound", direction: "inbound", from: "+14054287100", to: "+15802178444", forwarded_from: "+15802178444", date_created: "2026-11-20T00:00:17Z", duration: "46" };
  const leg: CarrierCall = { ...inbound, sid: "leg", direction: "outbound-dial", parent_call_sid: "original", forwarded_from: "+15807608568" };
  it("correlates self-forwarded calls only with a matching parent-linked leg", () => {
    expect(forwardedCallParent(inbound, [leg])).toBe("original");
  });
  it("preserves same-number/time calls without carrier leg evidence", () => {
    expect(forwardedCallParent(inbound, [{ ...leg, parent_call_sid: null }])).toBeNull();
  });
  it("preserves ambiguous matches", () => {
    expect(forwardedCallParent(inbound, [leg, { ...leg, sid: "other", parent_call_sid: "other-parent" }])).toBeNull();
  });
  it("never correlates excluded 214-number forwarding", () => {
    expect(forwardedCallParent(inbound, [{ ...leg, forwarded_from: "+12149786445" }])).toBeNull();
  });
  it("does not correlate calls outside the three-second carrier-leg window", () => {
    expect(forwardedCallParent(inbound, [{ ...leg, date_created: "2026-11-20T00:00:21Z" }])).toBeNull();
  });
  it("does not correlate mismatched durations", () => {
    expect(forwardedCallParent(inbound, [{ ...leg, duration: "44" }])).toBeNull();
  });
});
