import { describe, expect, it, vi } from "vitest";
import { backoffDelay, fetchWithRetry, shouldRetry } from "./provider-retry";

const res = (status: number) => new Response("x", { status });
const noSleep = vi.fn(async () => {});

describe("provider retries", () => {
  it("never retries a create that the provider rejected with a server error", () => {
    expect(shouldRetry("POST", 500)).toBe(false);
    expect(shouldRetry("POST", null)).toBe(false);
  });
  it("retries rate limits for every method", () => {
    expect(shouldRetry("POST", 429)).toBe(true);
    expect(shouldRetry("GET", 429)).toBe(true);
  });
  it("retries outages for reads and updates", () => {
    expect(shouldRetry("GET", 503)).toBe(true);
    expect(shouldRetry("PATCH", 502)).toBe(true);
    expect(shouldRetry("GET", 404)).toBe(false);
  });
  it("waits longer each attempt", () => {
    expect([0, 1, 2].map((a) => backoffDelay(a, 300))).toEqual([300, 600, 1200]);
  });
  it("recovers after a transient outage", async () => {
    const f = vi.fn().mockResolvedValueOnce(res(503)).mockResolvedValueOnce(res(200));
    const r = await fetchWithRetry(f, { method: "GET", sleep: noSleep });
    expect(r.status).toBe(200);
    expect(f).toHaveBeenCalledTimes(2);
  });
  it("stops after three attempts and returns the last failure", async () => {
    const f = vi.fn().mockResolvedValue(res(500));
    const r = await fetchWithRetry(f, { method: "GET", sleep: noSleep });
    expect(r.status).toBe(500);
    expect(f).toHaveBeenCalledTimes(3);
  });
  it("sends a text only once when the carrier errors", async () => {
    const f = vi.fn().mockResolvedValue(res(500));
    await fetchWithRetry(f, { method: "POST", sleep: noSleep });
    expect(f).toHaveBeenCalledTimes(1);
  });
});
