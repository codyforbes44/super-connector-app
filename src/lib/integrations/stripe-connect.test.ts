import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";

import { verifyStripeSignature } from "../stripe.server";
import {
  accountOnboardingLinkParams,
  assertConnectTestKey,
  cardPaymentsActive,
  directChargeCheckoutParams,
  interpretConnectEvent,
  merchantAccountParams,
} from "./stripe-connect";

describe("Stripe Connect test mode", () => {
  it("refuses live secret keys", () => {
    expect(() => assertConnectTestKey("sk_live_123")).toThrow(/test mode only/);
    expect(assertConnectTestKey("sk_test_123")).toBe("sk_test_123");
    expect(assertConnectTestKey("rk_test_123")).toBe("rk_test_123");
  });

  it("builds an Accounts v2 merchant with direct-charge responsibilities", () => {
    const params = merchantAccountParams({
      email: "owner@example.com",
      displayName: "Brooks Plumbing",
      userId: "user_1",
    });
    expect(params.dashboard).toBe("full");
    expect(params.defaults.responsibilities).toEqual({
      fees_collector: "stripe",
      losses_collector: "stripe",
    });
    expect(params.configuration.merchant.capabilities.card_payments.requested).toBe(true);
    expect(params).not.toHaveProperty("type");
    expect("recipient" in params.configuration).toBe(false);
  });

  it("creates a direct-charge Checkout Session on the connected account", () => {
    const { params, requestOptions } = directChargeCheckoutParams({
      amountCents: 12500,
      description: "Water heater flush",
      connectedAccountId: "acct_test_123",
      paymentId: "pay_1",
      conversationId: "convo_1",
      successUrl: "https://sixvox.3bi.io/pay/return",
      cancelUrl: "https://sixvox.3bi.io/pay/return?canceled=1",
      integrationId: "sixvox_quote_abcdefgh",
    });
    expect(requestOptions).toEqual({ stripeAccount: "acct_test_123" });
    expect(params.mode).toBe("payment");
    expect(params.integration_identifier).toBe("sixvox_quote_abcdefgh");
    expect(params).not.toHaveProperty("payment_method_types");
    expect(params).not.toHaveProperty("transfer_data");
    expect(params).not.toHaveProperty("application_fee_amount");
    expect(params.line_items[0]?.price_data.unit_amount).toBe(12500);
    expect(params.metadata.conversation_id).toBe("convo_1");
  });

  it("treats card_payments active as ready to charge", () => {
    expect(
      cardPaymentsActive({
        configuration: { merchant: { capabilities: { card_payments: { status: "active" } } } },
      }),
    ).toBe(true);
    expect(
      cardPaymentsActive({
        configuration: { merchant: { capabilities: { card_payments: { status: "pending" } } } },
      }),
    ).toBe(false);
  });

  it("opens onboarding with the merchant configuration only", () => {
    const link = accountOnboardingLinkParams({
      accountId: "acct_test_123",
      returnUrl: "https://sixvox.3bi.io/integrations",
      refreshUrl: "https://sixvox.3bi.io/integrations",
    });
    expect(link.use_case.account_onboarding.configurations).toEqual(["merchant"]);
    expect(link.account).toBe("acct_test_123");
  });
});

describe("Stripe Connect webhooks", () => {
  it("verifies the Stripe signature", async () => {
    const secret = "whsec_test";
    const body = JSON.stringify({
      id: "evt_1",
      type: "checkout.session.completed",
      livemode: false,
    });
    const timestamp = Math.floor(Date.now() / 1000);
    const signature = createHmac("sha256", secret).update(`${timestamp}.${body}`).digest("hex");
    const event = (await verifyStripeSignature(body, `t=${timestamp},v1=${signature}`, secret)) as {
      type: string;
    };
    expect(event.type).toBe("checkout.session.completed");
    await expect(verifyStripeSignature(body, `t=${timestamp},v1=deadbeef`, secret)).rejects.toThrow(
      /signature/i,
    );
  });

  it("logs a paid checkout and ignores live-mode events", () => {
    const paid = interpretConnectEvent({
      type: "checkout.session.completed",
      livemode: false,
      data: {
        object: {
          id: "cs_test_1",
          object: "checkout.session",
          payment_status: "paid",
          amount_total: 12500,
          metadata: { sixvox_payment_id: "pay_1" },
        },
      },
    });
    expect(paid).toMatchObject({
      ignore: false,
      status: "paid",
      paymentId: "pay_1",
      checkoutSessionId: "cs_test_1",
      amountCents: 12500,
    });
    if (!paid.ignore) expect(paid.note).toContain("$125.00");

    expect(
      interpretConnectEvent({
        type: "checkout.session.completed",
        livemode: true,
        data: { object: { id: "cs_live" } },
      }),
    ).toEqual({ ignore: true, reason: "live_mode_event" });
  });

  it("maps expiry and failure onto the thread status", () => {
    expect(
      interpretConnectEvent({
        type: "checkout.session.expired",
        livemode: false,
        data: { object: { id: "cs_test_2", metadata: { sixvox_payment_id: "pay_2" } } },
      }),
    ).toMatchObject({ status: "expired", paymentId: "pay_2" });
    expect(
      interpretConnectEvent({
        type: "payment_intent.payment_failed",
        livemode: false,
        data: { object: { id: "pi_1", amount: 5000 } },
      }),
    ).toMatchObject({ status: "failed" });
  });
});
