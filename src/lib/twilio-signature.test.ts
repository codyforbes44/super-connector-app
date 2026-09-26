import { createHmac } from "node:crypto";
import { afterEach, describe, expect, it, vi } from "vitest";

const logs = vi.hoisted(() => ({
  logWebhookError: vi.fn(async (_admin: unknown, _input: unknown) => undefined),
}));

vi.mock("@/integrations/supabase/client.server", () => ({
  supabaseAdmin: { kind: "admin" },
}));

vi.mock("@/lib/webhook-errors.server", () => ({
  logWebhookError: logs.logWebhookError,
}));

import { rejectWebhook, verifyTwilioWebhook } from "./twilio-signature.server";

const AUTH = "auth-token-value";
const TOKEN = "shared-token";

/** Independent of the production signer — this is the Twilio spec, via Node crypto. */
function twilioSignature(authToken: string, url: string, params: Record<string, string>): string {
  const joined = Object.keys(params)
    .sort()
    .map((key) => `${key}${params[key] ?? ""}`)
    .join("");
  return createHmac("sha1", authToken).update(`${url}${joined}`).digest("base64");
}

function formRequest(
  url: string,
  params: Record<string, string>,
  signature: string | null,
  headers: Record<string, string> = {},
) {
  const requestHeaders: Record<string, string> = {
    "content-type": "application/x-www-form-urlencoded",
    ...headers,
  };
  if (signature) requestHeaders["X-Twilio-Signature"] = signature;
  return new Request(url, {
    method: "POST",
    headers: requestHeaders,
    body: new URLSearchParams(params),
  });
}

afterEach(() => {
  vi.unstubAllEnvs();
  logs.logWebhookError.mockClear();
});

describe("Twilio webhook signatures", () => {
  it("matches the published HMAC-SHA1 construction", () => {
    const url = "https://sixvox.3bi.io/api/public/twilio/voice?t=shared-token";
    expect(
      twilioSignature(AUTH, url, {
        CallSid: "CA123",
        From: "+15551212",
        To: "+18005550199",
      }),
    ).toBe("f6UY4W1HfS43kAXxgM7LLBNPDKw=");
  });

  it("accepts a valid signature", async () => {
    vi.stubEnv("TWILIO_AUTH_TOKEN", AUTH);
    vi.stubEnv("TWILIO_WEBHOOK_TOKEN", TOKEN);
    const url = `https://sixvox.3bi.io/api/public/twilio/voice?t=${TOKEN}`;
    const params = { CallSid: "CA123", From: "+15551212", To: "+18005550199" };
    const result = await verifyTwilioWebhook(
      formRequest(url, params, twilioSignature(AUTH, url, params)),
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.via).toBe("signature");
      expect(result.params["From"]).toBe("+15551212");
    }
  });

  it("rejects an invalid signature even when ?t= is valid", async () => {
    vi.stubEnv("TWILIO_AUTH_TOKEN", AUTH);
    vi.stubEnv("TWILIO_WEBHOOK_TOKEN", TOKEN);
    const url = `https://sixvox.3bi.io/api/public/twilio/voice?t=${TOKEN}`;
    const params = { CallSid: "CA123", From: "+15551212" };
    const result = await verifyTwilioWebhook(
      formRequest(url, params, "aaaaaaaaaaaaaaaaaaaaaaaaaaa="),
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("signature mismatch");
  });

  it("rejects a missing signature even when ?t= is valid", async () => {
    vi.stubEnv("TWILIO_AUTH_TOKEN", AUTH);
    vi.stubEnv("TWILIO_WEBHOOK_TOKEN", TOKEN);
    const url = `https://sixvox.3bi.io/api/public/twilio/sms?t=${TOKEN}`;
    const result = await verifyTwilioWebhook(formRequest(url, { MessageSid: "SM1" }, null));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("missing signature");
  });

  it("reconstructs the public URL behind the proxy, including the query string", async () => {
    vi.stubEnv("TWILIO_AUTH_TOKEN", AUTH);
    vi.stubEnv("TWILIO_WEBHOOK_TOKEN", TOKEN);
    const path = "/api/public/twilio/sms";
    const params = { MessageSid: "SM123", Body: "hello", From: "+15551212" };
    const withQuery = `https://sixvox.3bi.io${path}?t=${TOKEN}`;
    const withoutQuery = `https://sixvox.3bi.io${path}`;
    const internal = `http://127.0.0.1:3000${path}?t=${TOKEN}`;
    const proxyHeaders = {
      "x-forwarded-host": "internal.lovable.app",
      "x-forwarded-proto": "http, https",
      host: "127.0.0.1:3000",
    };

    const stripped = await verifyTwilioWebhook(
      formRequest(internal, params, twilioSignature(AUTH, withoutQuery, params), proxyHeaders),
    );
    expect(stripped.ok).toBe(false);

    const signed = await verifyTwilioWebhook(
      formRequest(internal, params, twilioSignature(AUTH, withQuery, params), proxyHeaders),
    );
    expect(signed.ok).toBe(true);
    if (signed.ok) expect(signed.params["Body"]).toBe("hello");
  });

  it("accepts a JSON port-in body signed as url plus raw body", async () => {
    vi.stubEnv("TWILIO_AUTH_TOKEN", AUTH);
    vi.stubEnv("TWILIO_WEBHOOK_TOKEN", TOKEN);
    const url = `https://sixvox.3bi.io/api/public/twilio/port-in?t=${TOKEN}`;
    const payload = {
      port_in_request_sid: "KWaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      phone_number: "+15805550100",
      status: "waiting_for_signature",
      portable: true,
    };
    const raw = JSON.stringify(payload);
    const signature = createHmac("sha1", AUTH).update(`${url}${raw}`).digest("base64");
    const result = await verifyTwilioWebhook(
      new Request(url, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "X-Twilio-Signature": signature,
        },
        body: raw,
      }),
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.params["status"]).toBe("waiting_for_signature");
      expect(result.params["phone_number"]).toBe("+15805550100");
    }
  });

  it("rejects a signature for a different host even with a valid token", async () => {
    vi.stubEnv("TWILIO_AUTH_TOKEN", AUTH);
    vi.stubEnv("TWILIO_WEBHOOK_TOKEN", TOKEN);
    const url = `https://sixvox.3bi.io/api/public/twilio/status?t=${TOKEN}`;
    const params = { CallSid: "CA999" };
    const result = await verifyTwilioWebhook(
      formRequest(
        url,
        params,
        twilioSignature(AUTH, `https://evil.example/api/public/twilio/status?t=${TOKEN}`, params),
      ),
    );
    expect(result.ok).toBe(false);
  });

  it("logs rejections and does not record the shared token", async () => {
    const request = formRequest(
      `https://sixvox.3bi.io/api/public/twilio/voice?t=${TOKEN}`,
      { CallSid: "CA123", To: "+15550001111" },
      null,
    );
    const response = await rejectWebhook(request, "missing signature", {
      CallSid: "CA123",
      To: "+15550001111",
    });
    expect(response.status).toBe(401);
    expect(logs.logWebhookError).toHaveBeenCalledOnce();
    const input = logs.logWebhookError.mock.calls[0]?.[1] as {
      url: string;
      callSid: string;
      message: string;
      source: string;
    };
    expect(input.source).toBe("voice");
    expect(input.callSid).toBe("CA123");
    expect(input.message).toContain("missing signature");
    expect(input.url).not.toContain(TOKEN);
    expect(input.url).not.toContain("t=");
  });
});
