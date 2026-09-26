import { afterEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ runDueDigests: vi.fn() }));
vi.mock("@tanstack/react-router", () => ({
  createFileRoute: () => (config: unknown) => config,
}));
vi.mock("@/integrations/supabase/client.server", () => ({ supabaseAdmin: {} }));
vi.mock("@/lib/digest.server", () => ({ runDueDigests: mocks.runDueDigests }));

import { isDigestRequestAuthorized } from "./digest-auth.server";
import { Route } from "@/routes/api/public/digest/run";

const secret = "a".repeat(64); // Test fixture only.
const post = (
  Route as unknown as {
    server: {
      handlers: { POST: (args: { request: Request }) => Promise<Response> };
    };
  }
).server.handlers.POST;
const request = (headers: HeadersInit = {}) =>
  new Request("https://example.com/api/public/digest/run", {
    method: "POST",
    headers,
  });

afterEach(() => {
  vi.unstubAllEnvs();
  vi.clearAllMocks();
});

describe("digest scheduler authentication", () => {
  it("accepts only the dedicated bearer secret", () => {
    expect(isDigestRequestAuthorized(request({ Authorization: `Bearer ${secret}` }), secret)).toBe(
      true,
    );
    expect(isDigestRequestAuthorized(request({ Authorization: `bearer ${secret}` }), secret)).toBe(
      true,
    );
    expect(isDigestRequestAuthorized(request({ apikey: secret }), secret)).toBe(false);
    expect(
      isDigestRequestAuthorized(request({ Authorization: `Bearer ${"b".repeat(64)}` }), secret),
    ).toBe(false);
    expect(isDigestRequestAuthorized(request({ Authorization: "Bearer short" }), secret)).toBe(
      false,
    );
    expect(isDigestRequestAuthorized(request(), secret)).toBe(false);
  });

  it("fails closed for missing or malformed configuration", () => {
    vi.stubEnv("DIGEST_CRON_SECRET", "");
    expect(isDigestRequestAuthorized(request({ Authorization: `Bearer ${secret}` }))).toBe(false);
    expect(isDigestRequestAuthorized(request({ Authorization: "Bearer short" }), "short")).toBe(
      false,
    );
  });

  it("rejects the former public-key authentication before invoking the worker", async () => {
    vi.stubEnv("DIGEST_CRON_SECRET", secret);
    vi.stubEnv("SUPABASE_ANON_KEY", "old-public-key");
    vi.stubEnv("SUPABASE_PUBLISHABLE_KEY", "old-public-key");
    const response = await post({
      request: request({ apikey: "old-public-key" }),
    });
    expect(response.status).toBe(401);
    expect(mocks.runDueDigests).not.toHaveBeenCalled();
  });

  it("invokes the worker only for an authenticated scheduler", async () => {
    vi.stubEnv("DIGEST_CRON_SECRET", secret);
    mocks.runDueDigests.mockResolvedValueOnce({ sent: 0 });
    const response = await post({
      request: request({ Authorization: `Bearer ${secret}` }),
    });
    expect(response.status).toBe(200);
    expect(mocks.runDueDigests).toHaveBeenCalledOnce();
  });
});
