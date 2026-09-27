import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { CAPABILITY_ROWS, SOLO_COST_ROWS } from "./compare";
import { FEATURE_FLAGS } from "./feature-flags";
import { PLANS, TRIAL_LIMITS, planAllowanceLabel, priceIdFor } from "./plans";
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
      expect(labels).toContain("Per-line Spanish answering");
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
    expect(FEATURE_FLAGS.reviewRequests).toBe(true);
    expect(FEATURE_FLAGS.paymentLinks).toBe(true);
    expect(FEATURE_FLAGS.spanishAnswering).toBe(true);
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
    expect(cell("Spanish answering")).toMatch(/English only/);
    expect(cell("Spanish answering")).toMatch(/Spanish only/);
    expect(cell("Spanish answering")).toMatch(/Auto-detect/);
    expect(cell("Spanish answering")).toMatch(/prompt language/);
    expect(cell("Spanish answering")).toMatch(/transcript is Spanish/);
    expect(cell("Spanish answering")).toMatch(/custom template stays as saved/i);
    expect(cell("Spanish answering")).not.toMatch(/coming soon/i);
    expect(cell("Spanish answering")).not.toMatch(/unlimited/i);
  });

  it("does not call review requests, payment links, Jobber, or Spanish answering coming soon in marketing copy", () => {
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
      expect(source, file).not.toMatch(/spanish answering[^.]{0,220}coming soon/i);
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

describe("pricing seat label", () => {
  it("pluralizes one seat the same way numbers pluralize", () => {
    expect(planAllowanceLabel({ numbers: 1, seats: 1, aiCalls: 50 })).toBe(
      "1 number · 1 seat · 50 AI calls",
    );
    expect(planAllowanceLabel({ numbers: 3, seats: 5, aiCalls: 200 })).toBe(
      "3 numbers · 5 seats · 200 AI calls",
    );
    expect(planAllowanceLabel(PLANS.find((plan) => plan.code === "solo")!)).toBe(
      "1 number · 1 seat · 50 AI calls",
    );
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
