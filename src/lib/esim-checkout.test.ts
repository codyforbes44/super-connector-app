/** End-to-end eSIM checkout in test mode with stand-ins for payment and the eSIM partner. */
import { beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({ orders: new Map<string, Record<string, unknown>>(), placed: 0, paid: "paid" }));

function table(name: string) {
  let filterId: string | null = null;
  let patch: Record<string, unknown> | null = null;
  const api: Record<string, unknown> = {
    insert(row: Record<string, unknown>) { const id = "order-1"; db.orders.set(id, { id, ...row }); filterId = id; return api; },
    update(p: Record<string, unknown>) { patch = p; return api; },
    select() { return api; },
    eq(col: string, v: string) {
      if (col === "id") filterId = v;
      if (patch && filterId) { db.orders.set(filterId, { ...db.orders.get(filterId), ...patch }); }
      return api;
    },
    single: async () => ({ data: filterId ? db.orders.get(filterId) : null, error: null }),
    maybeSingle: async () => ({ data: name === "esim_orders" && filterId ? db.orders.get(filterId) : null, error: null }),
    then: (r: (v: unknown) => void) => r({ error: null }),
  };
  return api;
}
const client = { from: table };

vi.mock("@/integrations/supabase/client.server", () => ({ supabaseAdmin: client }));
vi.mock("./push.server", () => ({ sendPushToUsers: async () => {} }));
vi.mock("./stripe.server", () => ({
  getStripeErrorMessage: (e: Error) => e.message,
  createStripeClient: (env: string) => {
    if (env !== "sandbox") throw new Error("live payments must not be used in tests");
    return { checkout: { sessions: {
      create: async () => ({ id: "cs_test_1", client_secret: "cs_test_secret" }),
      retrieve: async () => ({ payment_status: db.paid, payment_intent: "pi_test_1" }),
    } } };
  },
}));
vi.mock("./esim-provider.server", () => ({
  EsimProviderNotConfigured: class extends Error {},
  esimProviderConfigured: () => true,
  fetchCatalogue: async () => [],
  fetchUsage: async () => null,
  fetchPackage: async (id: string) => ({ id, title: "USA 3GB", region: "United States", data: "3 GB", validityDays: 30, priceCents: 1200, apn: null }),
  placeOrder: async () => { db.placed++; throw new Error("real partner order attempted"); },
}));

import { finalizeOrder, placesRealOrder, startCheckout } from "./esim.server";

beforeEach(() => { db.orders.clear(); db.placed = 0; db.paid = "paid"; });

describe("eSIM checkout (test mode)", () => {
  it("creates a pending test order and a checkout session", async () => {
    const res = await startCheckout(client as never, "user-1", { packageId: "usa-3gb", returnUrl: "https://sixvox.3bi.io/esim", environment: "sandbox" });
    expect(res).toEqual({ clientSecret: "cs_test_secret", orderId: "order-1" });
    expect(db.orders.get("order-1")).toMatchObject({ status: "pending", environment: "sandbox", amount_cents: 1200, stripe_session_id: "cs_test_1" });
  });

  it("waits while the payment hasn't cleared", async () => {
    await startCheckout(client as never, "user-1", { packageId: "usa-3gb", returnUrl: "https://sixvox.3bi.io/esim", environment: "sandbox" });
    db.paid = "unpaid";
    const res = await finalizeOrder(client as never, "user-1", { orderId: "order-1", environment: "sandbox" });
    expect(res.error).toMatch(/hasn't cleared/);
    expect(db.orders.get("order-1")?.["status"]).toBe("pending");
  });

  it("activates a paid test order without buying a real eSIM", async () => {
    await startCheckout(client as never, "user-1", { packageId: "usa-3gb", returnUrl: "https://sixvox.3bi.io/esim", environment: "sandbox" });
    const res = await finalizeOrder(client as never, "user-1", { orderId: "order-1", environment: "sandbox" });
    expect(res.error).toBeNull();
    expect(db.placed).toBe(0);
    expect(db.orders.get("order-1")).toMatchObject({ status: "active", provider_order_id: "test-order-1" });
  });

  it("only live payments (or the partner sandbox) place real orders", () => {
    expect(placesRealOrder("live")).toBe(true);
    expect(placesRealOrder("sandbox")).toBe(false);
    expect(placesRealOrder("sandbox", "https://sandbox-partners-api.airalo.com")).toBe(true);
  });
});
