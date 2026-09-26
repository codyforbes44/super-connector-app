import { describe, expect, it } from "vitest";

import {
  assertEmergencyFeeConfirmed,
  buildEmergencyAddressParams,
  buildEmergencyAssociationParams,
  outboundCallBlock,
  parseSuggestedAddresses,
} from "./e911";

const SUGGESTED =
  '{"code":21629,"message":"Address validation error. | CustomerName: ACME, Street: 123 MAIN ST, Locality: AUSTIN, Region: TX, PostalCode: 78701, IsoCountry: US | CustomerName: ACME, Street: 125 MAIN ST, Locality: AUSTIN, Region: TX, PostalCode: 78701, IsoCountry: US"}';

describe("E911 addresses", () => {
  it("asks Twilio for an emergency-enabled address and does not auto-correct it", () => {
    const params = buildEmergencyAddressParams({
      customerName: "Acme Plumbing",
      street: "123 Main",
      city: "Austin",
      region: "TX",
      postalCode: "78701",
      isoCountry: "us",
      phoneNumber: "+15125550100",
    });
    expect(params["EmergencyEnabled"]).toBe(true);
    expect(params["AutoCorrectAddress"]).toBe(false);
    expect(String(params["FriendlyName"]).length).toBeLessThanOrEqual(32);
    expect(params["IsoCountry"]).toBe("US");
  });

  it("associates the address and marks emergency calling active", () => {
    expect(buildEmergencyAssociationParams("AD123")).toEqual({
      EmergencyAddressSid: "AD123",
      EmergencyStatus: "Active",
    });
  });

  it("surfaces every suggested address from error 21629", () => {
    const suggestions = parseSuggestedAddresses(SUGGESTED);
    expect(suggestions).toHaveLength(2);
    expect(suggestions[0]).toMatchObject({
      customerName: "ACME",
      street: "123 MAIN ST",
      city: "AUSTIN",
      region: "TX",
      postalCode: "78701",
      isoCountry: "US",
    });
  });

  it("refuses to register an address until the monthly fee is confirmed", () => {
    expect(() => assertEmergencyFeeConfirmed(false)).toThrow(/\$0\.75/);
    expect(() => assertEmergencyFeeConfirmed(true)).not.toThrow();
  });

  it("blocks outbound calls until the 911 disclosure is acknowledged", () => {
    expect(outboundCallBlock(false)).toBe("e911_acknowledgment");
    expect(outboundCallBlock(true)).toBeNull();
  });
});
