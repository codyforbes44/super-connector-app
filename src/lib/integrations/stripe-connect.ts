/**
 * Stripe Connect for job payments.
 *
 * SixVox is a SaaS platform: the tradesperson owns the customer and is the
 * merchant of record. Money is a direct charge on their connected account
 * (Stripe-Account header). It does not settle on SixVox's platform balance.
 *
 * Accounts v2, dashboard "full", fees_collector "stripe", losses_collector
 * "stripe", merchant.card_payments. No legacy `type: express|custom|standard`.
 * Subscriptions stay on the existing SixVox billing integration.
 *
 * Test mode only.
 */

export const CONNECT_TEST_KEY_MESSAGE =
  "Stripe Connect is test mode only. Set STRIPE_CONNECT_SECRET_KEY to a test key (sk_test_ or rk_test_). Live keys are refused.";

export function assertConnectTestKey(secretKey: string | undefined | null): string {
  const key = secretKey?.trim() ?? "";
  if (!key.startsWith("sk_test_") && !key.startsWith("rk_test_")) {
    throw new Error(CONNECT_TEST_KEY_MESSAGE);
  }
  return key;
}

export type MerchantAccountInput = {
  email: string;
  displayName: string;
  userId: string;
  workspaceId?: string | null;
};

export function merchantAccountParams(input: MerchantAccountInput) {
  return {
    contact_email: input.email,
    display_name: input.displayName,
    dashboard: "full" as const,
    identity: {
      country: "us" as const,
      entity_type: "individual" as const,
    },
    configuration: {
      merchant: {
        capabilities: {
          card_payments: { requested: true },
        },
      },
    },
    defaults: {
      currency: "usd",
      responsibilities: {
        fees_collector: "stripe" as const,
        losses_collector: "stripe" as const,
      },
    },
    metadata: {
      sixvox_user_id: input.userId,
      ...(input.workspaceId ? { sixvox_workspace_id: input.workspaceId } : {}),
    },
    include: ["configuration.merchant", "requirements"] as Array<
      "configuration.merchant" | "requirements"
    >,
  };
}

export function accountOnboardingLinkParams(input: {
  accountId: string;
  returnUrl: string;
  refreshUrl: string;
}) {
  return {
    account: input.accountId,
    use_case: {
      type: "account_onboarding" as const,
      account_onboarding: {
        configurations: ["merchant"] as Array<"merchant">,
        refresh_url: input.refreshUrl,
        return_url: input.returnUrl,
      },
    },
  };
}

const ALPHABET = "abcdefghijklmnopqrstuvwxyz";

export function integrationIdentifier(random?: () => number): string {
  const next = random ?? Math.random;
  let suffix = "";
  for (let i = 0; i < 8; i += 1) suffix += ALPHABET[Math.floor(next() * ALPHABET.length)];
  return `sixvox_quote_${suffix}`;
}

export function parseAmountToCents(raw: string): number {
  const cleaned = raw.trim().replace(/[$,\s]/g, "");
  if (!/^\d+(\.\d{1,2})?$/.test(cleaned)) {
    throw new Error("Enter a dollar amount like 125 or 125.50.");
  }
  const cents = Math.round(Number(cleaned) * 100);
  if (cents < 100) throw new Error("The minimum payment link is $1.00.");
  if (cents > 5_000_000) throw new Error("The maximum payment link is $50,000.");
  return cents;
}

export function formatUsd(cents: number): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(cents / 100);
}

export type DirectChargeInput = {
  amountCents: number;
  description: string;
  connectedAccountId: string;
  paymentId: string;
  conversationId: string;
  successUrl: string;
  cancelUrl: string;
  integrationId?: string;
};

/** Checkout Session params for a direct charge. No destination transfer, no platform fee. */
export function directChargeCheckoutParams(input: DirectChargeInput) {
  const description = input.description.trim();
  if (!description) throw new Error("Add a short description of the quote or invoice.");
  if (!input.connectedAccountId.startsWith("acct_")) {
    throw new Error("Connect a Stripe test account before creating a payment link.");
  }
  return {
    params: {
      mode: "payment" as const,
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: "usd",
            unit_amount: input.amountCents,
            product_data: { name: description.slice(0, 120) },
          },
        },
      ],
      success_url: input.successUrl,
      cancel_url: input.cancelUrl,
      metadata: {
        sixvox_payment_id: input.paymentId,
        conversation_id: input.conversationId,
      },
      integration_identifier: input.integrationId ?? integrationIdentifier(),
    },
    requestOptions: { stripeAccount: input.connectedAccountId },
  };
}

export type CardPaymentsStatus = "active" | "pending" | "restricted" | "inactive" | "unknown";

export function cardPaymentsStatus(account: {
  configuration?: {
    merchant?: {
      capabilities?: { card_payments?: { status?: string | null } | null } | null;
    } | null;
  } | null;
}): CardPaymentsStatus {
  const status = account.configuration?.merchant?.capabilities?.card_payments?.status ?? "";
  if (
    status === "active" ||
    status === "pending" ||
    status === "restricted" ||
    status === "inactive"
  ) {
    return status;
  }
  return "unknown";
}

export function cardPaymentsActive(account: Parameters<typeof cardPaymentsStatus>[0]): boolean {
  return cardPaymentsStatus(account) === "active";
}

export type ConnectPaymentStatus = "created" | "sent" | "paid" | "unpaid" | "expired" | "failed";

export type ConnectEventResult =
  | { ignore: true; reason: string }
  | {
      ignore: false;
      paymentId: string | null;
      checkoutSessionId: string | null;
      status: ConnectPaymentStatus;
      amountCents: number | null;
      note: string;
    };

type StripeEvent = {
  id?: string;
  type?: string;
  livemode?: boolean;
  account?: string | null;
  data?: { object?: Record<string, unknown> };
};

function sessionId(object: Record<string, unknown>): string | null {
  return typeof object["id"] === "string" ? object["id"] : null;
}

function metadataPaymentId(object: Record<string, unknown>): string | null {
  const metadata = object["metadata"];
  if (!metadata || typeof metadata !== "object") return null;
  const id = (metadata as Record<string, unknown>)["sixvox_payment_id"];
  return typeof id === "string" ? id : null;
}

export function interpretConnectEvent(event: StripeEvent): ConnectEventResult {
  if (event.livemode === true) {
    return { ignore: true, reason: "live_mode_event" };
  }
  const type = event.type ?? "";
  const object = event.data?.object ?? {};
  switch (type) {
    case "checkout.session.completed":
    case "checkout.session.async_payment_succeeded": {
      const paid = object["payment_status"] === "paid" || type.endsWith("succeeded");
      const amount = typeof object["amount_total"] === "number" ? object["amount_total"] : null;
      return {
        ignore: false,
        paymentId: metadataPaymentId(object),
        checkoutSessionId: sessionId(object),
        status: paid ? "paid" : "unpaid",
        amountCents: amount,
        note: paid
          ? `Payment received${amount !== null ? ` · ${formatUsd(amount)}` : ""}.`
          : "Checkout finished and the payment is still processing.",
      };
    }
    case "checkout.session.async_payment_failed":
    case "payment_intent.payment_failed":
      return {
        ignore: false,
        paymentId: metadataPaymentId(object),
        checkoutSessionId:
          typeof object["id"] === "string" && object["object"] === "checkout.session"
            ? object["id"]
            : null,
        status: "failed",
        amountCents: typeof object["amount"] === "number" ? object["amount"] : null,
        note: "Payment failed.",
      };
    case "checkout.session.expired":
      return {
        ignore: false,
        paymentId: metadataPaymentId(object),
        checkoutSessionId: sessionId(object),
        status: "expired",
        amountCents: typeof object["amount_total"] === "number" ? object["amount_total"] : null,
        note: "Payment link expired before it was paid.",
      };
    default: {
      const unexpected: never | string = type;
      return { ignore: true, reason: `unhandled:${unexpected}` };
    }
  }
}
