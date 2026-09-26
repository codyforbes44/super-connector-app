import { describe, expect, it } from "vitest";

import { signElevenLabs, verifyElevenLabsRequest } from "./elevenlabs-signature.server";

const secret = "test-elevenlabs-secret";

function request(
  headers: Record<string, string>,
  url = "https://sixvox.3bi.io/api/public/elevenlabs/tool/propose_booking",
) {
  return new Request(url, { method: "POST", headers });
}

describe("verifyElevenLabsRequest", () => {
  it("accepts the ElevenLabs HMAC signature", async () => {
    const body = JSON.stringify({ called_number: "+15807450045" });
    const timestamp = 1_700_000_000;
    const signature = await signElevenLabs(secret, body, timestamp);
    const previous = process.env["ELEVENLABS_WEBHOOK_SECRET"];
    process.env["ELEVENLABS_WEBHOOK_SECRET"] = secret;
    const result = await verifyElevenLabsRequest(
      request({ "elevenlabs-signature": `t=${timestamp},v0=${signature}` }),
      body,
      timestamp * 1000,
    );
    if (previous === undefined) delete process.env["ELEVENLABS_WEBHOOK_SECRET"];
    else process.env["ELEVENLABS_WEBHOOK_SECRET"] = previous;
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.via).toBe("signature");
  });

  it("accepts the shared tool secret and rejects a bad signature", async () => {
    const previous = process.env["ELEVENLABS_TOOL_SECRET"];
    process.env["ELEVENLABS_TOOL_SECRET"] = secret;
    const good = await verifyElevenLabsRequest(request({ "x-sixvox-tool-secret": secret }), "{}");
    const bad = await verifyElevenLabsRequest(
      request({ "elevenlabs-signature": "t=1,v0=deadbeef" }),
      "{}",
      1_000,
    );
    if (previous === undefined) delete process.env["ELEVENLABS_TOOL_SECRET"];
    else process.env["ELEVENLABS_TOOL_SECRET"] = previous;
    expect(good.ok).toBe(true);
    expect(bad.ok).toBe(false);
  });
});
