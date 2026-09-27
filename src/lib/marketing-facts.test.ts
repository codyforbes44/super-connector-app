import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { CAPABILITY_ROWS, SOLO_COST_ROWS } from "./compare";
import { FEATURE_FLAGS } from "./feature-flags";
import { HOUSECALL_ZAPIER_COPY } from "./integrations/housecall";
import { PLANS, TRIAL_LIMITS, priceIdFor } from "./plans";
import { TRADES } from "./trades";

describe("plan config", () => {
  it("keeps the current dollar amounts and Phase 1 limits", () => {
    expect(
      PLANS.map((plan) => [
        plan.code,
        plan.monthly,
        plan.yearly,
        plan.numbers,
        plan.seats,
        plan.aiCalls,
      ]),
    ).toEqual([
      ["solo", 29, 290, 1, 1, 50],
      ["team", 59, 590, 3, 5, 200],
      ["scale", 129, 1290, 10, 20, 600],
    ]);
    expect(TRIAL_LIMITS).toEqual({ numbers: 1, seats: 1, aiCalls: 20 });
  });

  it("does not change Stripe price ids", () => {
    expect(priceIdFor("solo", "month")).toBe("solo_monthly");
    expect(priceIdFor("team", "year")).toBe("team_yearly");
    expect(priceIdFor("scale", "month")).toBe("scale_monthly");
  });

  it("puts the receptionist and text-back on every plan", () => {
    for (const plan of PLANS) {
      const labels = plan.features.map((feature) => feature.label);
      expect(labels).toContain("AI receptionist on your line");
      expect(labels).toContain("Missed-call text-back");
      expect(labels).toContain("A2P texting registration handled for you");
    }
  });
});

describe("competitor facts", () => {
  it("uses only the Sep 2026 list prices from the plan", () => {
    expect(SOLO_COST_ROWS.map((row) => row.monthly)).toEqual([
      "$29",
      "$59",
      "$19 + $25 = $44",
      "$18",
      "$49 + $29 = $78 ($58 yearly)",
    ]);
    const quo = CAPABILITY_ROWS.find((row) => row.capability === "AI receptionist");
    expect(quo?.quo).toBe("Sona: ~10 calls free, then $25/40 calls");
    expect(quo?.googleVoice).toBe("No");
    expect(quo?.grasshopper).toBe("Virtual Receptionist add-on, from $95 (3rd party)");
  });
});

describe("coming soon flags", () => {
  it("marks shipped line controls on and leaves unproductized work off", () => {
    expect(FEATURE_FLAGS.missedCallTextBack).toBe(true);
    expect(FEATURE_FLAGS.businessHours).toBe(true);
    expect(FEATURE_FLAGS.aiBookingWithApproval).toBe(true);
    expect(FEATURE_FLAGS.nativeApp).toBe(false);
    expect(FEATURE_FLAGS.portIn).toBe(false);
    expect(FEATURE_FLAGS.jobber).toBe(true);
    expect(FEATURE_FLAGS.housecall).toBe(true);
    expect(FEATURE_FLAGS.reviewRequests).toBe(true);
    expect(FEATURE_FLAGS.paymentLinks).toBe(true);
  });

  it("matches SixVox compare cells to what is in the app", () => {
    const cell = (capability: string) =>
      CAPABILITY_ROWS.find((row) => row.capability === capability)?.sixvox ?? "";

    expect(cell("Missed-call auto text")).toMatch(/line settings/i);
    expect(cell("Missed-call auto text")).not.toMatch(/not built|coming soon/i);
    expect(cell("Books into calendar")).toMatch(/approval/i);
    expect(cell("Books into calendar")).toMatch(/automatic/i);
    expect(cell("Books into calendar")).not.toMatch(/coming soon/i);
    expect(cell("E911")).toMatch(/register/i);
    expect(cell("E911")).not.toBe("No");
    expect(cell("Shared inbox + roles")).toMatch(/per workspace/i);
    expect(cell("Shared inbox + roles")).not.toMatch(/global roles/i);
    expect(cell("Native iOS/Android calling")).toMatch(/coming soon/i);
    expect(cell("CRM / FSM integrations")).toMatch(/Integrations/);
    expect(cell("CRM / FSM integrations")).toMatch(/create or match a client/);
    expect(cell("CRM / FSM integrations")).toMatch(/request/);
    expect(cell("CRM / FSM integrations")).toMatch(/JOBBER_CLIENT_ID/);
    expect(cell("CRM / FSM integrations")).toMatch(/JOBBER_CLIENT_SECRET/);
    expect(cell("CRM / FSM integrations")).toMatch(/Tokens stay on the server/);
    expect(cell("CRM / FSM integrations")).toMatch(/Housecall Pro/);
    expect(cell("CRM / FSM integrations")).toMatch(/API key/);
    expect(cell("CRM / FSM integrations")).toMatch(/customer/);
    expect(cell("CRM / FSM integrations")).toMatch(/lead/);
    expect(cell("CRM / FSM integrations")).toMatch(/MAX/);
    expect(cell("CRM / FSM integrations")).toMatch(/Basic and Essentials/);
    expect(cell("CRM / FSM integrations")).not.toMatch(/coming soon/i);
    expect(cell("Porting")).toMatch(/coming soon/i);
    expect(cell("Review requests")).toMatch(/Mark job done/i);
    expect(cell("Review requests")).toMatch(/Integrations/i);
    expect(cell("Review requests")).toMatch(/quiet hours/i);
    expect(cell("Review requests")).toMatch(/cooldown/i);
    expect(cell("Review requests")).toMatch(/STOP/);
    expect(cell("Review requests")).not.toMatch(/coming soon/i);
    expect(cell("Payment links")).toMatch(/Stripe Connect/i);
    expect(cell("Payment links")).toMatch(/test mode/i);
    expect(cell("Payment links")).toMatch(/connected account/i);
    expect(cell("Payment links")).not.toMatch(/coming soon/i);
  });

  it("describes the Housecall Pro Integrations path and MAX gate on the features page", () => {
    const source = readFileSync(new URL("../routes/features.tsx", import.meta.url), "utf8");
    expect(source).toMatch(/flag: "housecall"/);
    expect(source).toMatch(/Save a MAX-plan API key under Integrations/);
    expect(source).toMatch(/create a customer and lead from a call thread/);
    expect(source).toMatch(/Basic and Essentials cannot use the public API/);
    expect(source).not.toMatch(/housecall[^.]{0,180}coming soon/i);
  });

  it("points non-MAX Housecall users at shipped outbound webhooks", () => {
    expect(HOUSECALL_ZAPIER_COPY).toMatch(/Settings → Outbound webhooks/);
    expect(HOUSECALL_ZAPIER_COPY).toMatch(/HMAC-SHA256/);
    expect(HOUSECALL_ZAPIER_COPY).toMatch(/Zapier or Make/);
    expect(HOUSECALL_ZAPIER_COPY).not.toMatch(/being added separately/i);
    expect(HOUSECALL_ZAPIER_COPY).not.toMatch(/coming soon/i);
  });

  it("does not call review requests, payment links, Jobber, or Housecall Pro coming soon in marketing copy", () => {
    const files = [
      "routes/index.tsx",
      "routes/pricing.tsx",
      "routes/features.tsx",
      "routes/faq.tsx",
      "routes/compare.tsx",
      "routes/use-cases.tsx",
      "routes/how-it-works.tsx",
      "lib/compare.ts",
      "lib/concierge/knowledge.ts",
      "lib/concierge/prompt.ts",
    ];
    for (const file of files) {
      const source = readFileSync(new URL(`../${file}`, import.meta.url), "utf8");
      expect(source, file).not.toMatch(/review (requests|texts|link)[^.]{0,120}coming soon/i);
      expect(source, file).not.toMatch(/payment links?[^.]{0,120}coming soon/i);
      expect(source, file).not.toMatch(/jobber[^.]{0,180}coming soon/i);
      expect(source, file).not.toMatch(/housecall[^.]{0,180}coming soon/i);
    }
  });
});

describe("trade pages", () => {
  it("covers the trades in the buyer description", () => {
    expect(TRADES.map((trade) => trade.slug)).toEqual([
      "plumbers",
      "hvac",
      "electricians",
      "cleaners",
      "handyman",
      "landscaping",
      "garage-doors",
    ]);
  });
});

describe("marketing copy", () => {
  it("does not name the old bring-your-own-Twilio competitors", () => {
    const files = [
      "routes/index.tsx",
      "routes/pricing.tsx",
      "routes/features.tsx",
      "routes/faq.tsx",
      "routes/compare.tsx",
      "routes/use-cases.tsx",
      "routes/how-it-works.tsx",
    ];
    for (const file of files) {
      const source = readFileSync(new URL(`../${file}`, import.meta.url), "utf8");
      expect(source).not.toMatch(/Talkyto|Toktiv|Mango/);
      expect(source).not.toMatch(/billed at cost|usage billed/i);
    }
  });
});
