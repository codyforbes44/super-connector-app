/**
 * Smoke tests for the four flows a customer can't live without: signing up,
 * checking out, texting and answering a call. All providers are stand-ins —
 * no real calls, texts or charges.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const rows = vi.hoisted(() => ({ entitlements: [] as Record<string, unknown>[] }));

vi.mock("@/integrations/supabase/client.server", () => ({
  supabaseAdmin: {
    from(table: string) {
      if (table === "plan_limits") {
        return { select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: null, error: null }) }) }) };
      }
      return {
        upsert: async (row: Record<string, unknown>) => {
          rows.entitlements.push(row);
          return { error: null };
        },
        insert: async () => ({ error: null }),
      };
    },
  },
}));

import { seedTrialEntitlements } from "./entitlements.server";
import { TRIAL_LIMITS, parsePriceId, priceIdFor } from "./plans";
import { fetchWithRetry } from "./provider-retry";
import { inboundClientDialTwiml } from "./voice-answer.server";

beforeEach(() => {
  rows.entitlements = [];
});

describe("sign-up", () => {
  it("gives a new team the free trial limits", async () => {
    await seedTrialEntitlements("new-team");
    expect(rows.entitlements).toHaveLength(1);
    expect(rows.entitlements[0]).toMatchObject({
      workspace_id: "new-team",
      plan_code: "trial",
      status: "trialing",
      max_numbers: TRIAL_LIMITS.numbers,
      max_seats: TRIAL_LIMITS.seats,
      included_ai_calls: TRIAL_LIMITS.aiCalls,
    });
  });
});

describe("checkout", () => {
  it("sends Solo buyers to the solo_monthly and solo_yearly prices", () => {
    expect(priceIdFor("solo", "month")).toBe("solo_monthly");
    expect(priceIdFor("solo", "year")).toBe("solo_yearly");
  });
  it("maps a paid price back to the right plan", () => {
    expect(parsePriceId("team_yearly")).toEqual({ plan: "team", interval: "year" });
    expect(parsePriceId("unknown_monthly").plan).toBeNull();
  });
});

describe("texting", () => {
  it("sends a text once even if the carrier has an outage", async () => {
    const send = vi.fn(async () => new Response("down", { status: 503 }));
    const res = await fetchWithRetry(send, { method: "POST", sleep: async () => {} });
    expect(res.status).toBe(503);
    expect(send).toHaveBeenCalledTimes(1);
  });
});

describe("answering a call", () => {
  it("rings every signed-in teammate in the app with an audible ringback", () => {
    const twiml = inboundClientDialTwiml({
      record: false,
      callerId: "+15805550100",
      timeoutSeconds: 20,
      actionUrl: "https://sixvox.3bi.io/api/public/twilio/dial-status",
      clientIdentities: ["user-a", "user-b"],
    });
    expect(twiml).toContain("<Client>user-a</Client>");
    expect(twiml).toContain("<Client>user-b</Client>");
    expect(twiml).toContain('ringTone="us"');
    expect(twiml).toContain('answerOnBridge="true"');
  });
});
