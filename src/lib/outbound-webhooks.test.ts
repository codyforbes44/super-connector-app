import { describe, expect, it } from "vitest";

import {
  RETRY_BACKOFF_SECONDS,
  nextRetryAt,
  retryDelaySeconds,
  signWebhookBody,
  verifyWebhookSignature,
} from "./outbound-webhooks";

describe("webhook signatures", () => {
  it("round-trips HMAC-SHA256 and rejects a stale timestamp", async () => {
    const body = JSON.stringify({ id: "evt_1", type: "lead.captured", data: { name: "Ada" } });
    const timestamp = "1760000000";
    const signature = await signWebhookBody("secret", timestamp, body);
    expect(signature.startsWith("v1=")).toBe(true);
    const ok = await verifyWebhookSignature({
      secret: "secret",
      timestamp,
      signature,
      body,
      nowSeconds: 1760000000,
    });
    expect(ok).toEqual({ ok: true });

    const stale = await verifyWebhookSignature({
      secret: "secret",
      timestamp,
      signature,
      body,
      nowSeconds: 1760000000 + 301,
    });
    expect(stale.ok).toBe(false);

    const tampered = await verifyWebhookSignature({
      secret: "secret",
      timestamp,
      signature,
      body: body + " ",
      nowSeconds: 1760000000,
    });
    expect(tampered).toEqual({ ok: false, reason: "signature mismatch" });
  });
});

describe("retry schedule", () => {
  it("backs off 60s, 5m, 30m, 2h, and 6h, then stops", () => {
    expect(retryDelaySeconds(0)).toBe(0);
    expect(RETRY_BACKOFF_SECONDS).toEqual([60, 300, 1800, 7200, 21600]);
    for (let attempt = 1; attempt <= RETRY_BACKOFF_SECONDS.length; attempt += 1) {
      expect(retryDelaySeconds(attempt)).toBe(RETRY_BACKOFF_SECONDS[attempt - 1]);
    }
    expect(retryDelaySeconds(RETRY_BACKOFF_SECONDS.length + 1)).toBeNull();

    const now = new Date("2026-09-26T15:00:00.000Z");
    const next = nextRetryAt(1, now);
    expect(next?.toISOString()).toBe("2026-09-26T15:01:00.000Z");
    expect(nextRetryAt(6, now)).toBeNull();
  });
});
