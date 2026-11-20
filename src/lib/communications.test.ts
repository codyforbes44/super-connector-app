import { describe, expect, it } from "vitest";
import { carrierMediaPath, deliveryCounts } from "./communications";
describe("communications truth", () => {
  it("counts delivered and failed texts from their recorded states, excluding inbound", () => {
    expect(deliveryCounts([{direction:"outbound",status:"delivered"},{direction:"outbound",status:"undelivered"},{direction:"outbound",status:"queued"},{direction:"inbound",status:"received"}])).toEqual({total:3,sent:1,delivered:1,pending:1,failed:1});
  });
  it("permits only carrier message media resource URLs", () => {
    expect(carrierMediaPath("https://api.twilio.com/2010-04-01/Accounts/AC"+"a".repeat(32)+"/Messages/MM"+"b".repeat(32)+"/Media/ME"+"c".repeat(32))).toBe("/Messages/MM"+"b".repeat(32)+"/Media/ME"+"c".repeat(32));
    expect(carrierMediaPath("https://attacker.example/private")).toBeNull();
    expect(carrierMediaPath("https://api.twilio.com/Calls.json")).toBeNull();
  });
});