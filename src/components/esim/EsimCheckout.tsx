import { EmbeddedCheckout, EmbeddedCheckoutProvider } from "@stripe/react-stripe-js";

import { startEsimCheckout } from "@/lib/esim.functions";
import { getStripe, getStripeEnvironment } from "@/lib/stripe";

export function EsimCheckout({ packageId }: { packageId: string }) {
  const fetchClientSecret = async (): Promise<string> => {
    const result = await startEsimCheckout({
      data: {
        packageId,
        returnUrl: `${window.location.origin}/esim`,
        environment: getStripeEnvironment(),
      },
    });
    if ("error" in result) throw new Error(result.error);
    if (!result.clientSecret) throw new Error("Checkout could not be started.");
    return result.clientSecret;
  };

  return (
    <div className="overflow-hidden rounded-3xl bg-white">
      <EmbeddedCheckoutProvider stripe={getStripe()} options={{ fetchClientSecret }}>
        <EmbeddedCheckout />
      </EmbeddedCheckoutProvider>
    </div>
  );
}
