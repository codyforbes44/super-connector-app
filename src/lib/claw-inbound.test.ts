import { describe, expect, it } from "vitest";
import { clawChannel, clawMessageSchema, extractToken, tokenMatches } from "./claw-inbound";

describe("claw inbound", () => {
  it("rejects when no token is configured", () => {
    expect(tokenMatches("abc", undefined)).toBe(false);
  });
  it("rejects a wrong token and accepts the right one", () => {
    expect(tokenMatches("abd", "abc")).toBe(false);
    expect(tokenMatches("abc", "abc")).toBe(true);
  });
  it("reads a bearer token", () => {
    const r = new Request("https://x/a", { headers: { authorization: "Bearer t1" } });
    expect(extractToken(r)).toBe("t1");
  });
  it("maps services to channels", () => {
    expect(clawChannel("iMessage")).toBe("imessage");
    expect(clawChannel("RCS")).toBe("rcs");
    expect(clawChannel("SMS")).toBe("sms");
  });
  it("rejects a sender that isn't a phone number", () => {
    expect(clawMessageSchema.safeParse({ messageId: "m", from: "bob" }).success).toBe(false);
  });
  it("parses Claw's documented message event", () => {
    const p = clawMessageSchema.parse({
      type: "message", messageId: "abc123", from: "+1234567890", text: "Yes", service: "iMessage",
    });
    expect(p.attachments).toEqual([]);
  });
});
