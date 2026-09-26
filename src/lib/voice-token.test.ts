import { afterEach, describe, expect, it } from "vitest";

import { mintVoiceToken } from "./voice-token.server";

const envKeys = ["TWILIO_ACCOUNT_SID", "TWILIO_API_KEY_SID", "TWILIO_API_KEY_SECRET"] as const;

afterEach(() => {
  for (const key of envKeys) delete process.env[key];
});

function payloadOf(token: string): {
  grants: { voice: Record<string, unknown>; identity: string };
} {
  const segment = token.split(".")[1] ?? "";
  return JSON.parse(Buffer.from(segment, "base64url").toString("utf8")) as {
    grants: { voice: Record<string, unknown>; identity: string };
  };
}

describe("mintVoiceToken", () => {
  it("omits the push credential for browser tokens", async () => {
    process.env["TWILIO_ACCOUNT_SID"] = "ACaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
    process.env["TWILIO_API_KEY_SID"] = "SKaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
    process.env["TWILIO_API_KEY_SECRET"] = "secret";
    const minted = await mintVoiceToken({
      userId: "user-1",
      applicationSid: "APaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
    });
    expect(payloadOf(minted.token).grants.voice["push_credential_sid"]).toBeUndefined();
  });

  it("embeds a mobile push credential SID in the voice grant", async () => {
    process.env["TWILIO_ACCOUNT_SID"] = "ACaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
    process.env["TWILIO_API_KEY_SID"] = "SKaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
    process.env["TWILIO_API_KEY_SECRET"] = "secret";
    const sid = "CR" + "d".repeat(32);
    const minted = await mintVoiceToken({
      userId: "user-1",
      applicationSid: "APaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      pushCredentialSid: sid,
    });
    expect(payloadOf(minted.token).grants.voice["push_credential_sid"]).toBe(sid);
    expect(payloadOf(minted.token).grants.identity).toBe("agent_user-1");
  });
});
