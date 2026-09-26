import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { ScreenHeader } from "@/components/AppShell";
import { IntegrationsPage } from "@/components/integrations/IntegrationsPage";
import type { IntegrationsSnapshot, ReviewSettingsInput } from "@/components/integrations/types";
import { ErrorState, ListSkeleton, PullToRefresh } from "@/components/screen";
import { HOUSECALL_MAX_PLAN_COPY } from "@/lib/integrations/housecall";
import { REGISTERED_TEXTING_E164 } from "@/lib/integrations/automated-text";
import type { PortDraft } from "@/lib/integrations/port-in";
import { errorMessage } from "@/lib/format";
import {
  beginJobberConnect,
  beginStripeConnect,
  confirmPortInSubmit,
  disconnectHousecallAccount,
  disconnectJobberAccount,
  getIntegrationsOverview,
  refreshStripeConnect,
  saveHousecallApiKey,
  savePortInDraft,
  saveReviewRequestSettings,
} from "@/lib/trade.functions";

export const Route = createFileRoute("/_authenticated/integrations")({
  validateSearch: (search: Record<string, unknown>): { stripe?: "return" | "refresh" } => {
    const stripe = search["stripe"];
    if (stripe === "return" || stripe === "refresh") return { stripe };
    return {};
  },
  head: () => ({
    meta: [
      { title: "Integrations — SixVox" },
      {
        name: "description",
        content:
          "Connect Jobber, Housecall Pro, review texts, Stripe test payments, and number porting.",
      },
      { property: "og:title", content: "Integrations — SixVox" },
      {
        property: "og:description",
        content:
          "Connect Jobber, Housecall Pro, review texts, Stripe test payments, and number porting.",
      },
    ],
  }),
  component: IntegrationsScreen,
});

function emptySnapshot(): IntegrationsSnapshot {
  return {
    registeredTextingNumber: REGISTERED_TEXTING_E164,
    jobber: { configured: false, connected: false, accountName: null },
    housecall: { connected: false, keyHint: null, maxPlanCopy: HOUSECALL_MAX_PLAN_COPY },
    reviews: {
      reviewUrl: "",
      businessName: "",
      enabled: false,
      cooldownDays: 90,
      quietStart: "21:00",
      quietEnd: "08:00",
      timezone: "America/Chicago",
    },
    connect: {
      configured: false,
      accountId: null,
      cardPayments: "unknown",
      chargesActive: false,
      label: null,
    },
    port: {
      id: null,
      status: null,
      phoneNumber: null,
      accountLast4: null,
      rejectionReason: null,
      forwardingDefault: true,
      liveEnabled: false,
    },
  };
}

function IntegrationsScreen() {
  const { stripe } = Route.useSearch();
  const queryClient = useQueryClient();
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const overview = useQuery({
    queryKey: ["integrations-overview"],
    queryFn: () => getIntegrationsOverview(),
  });

  useEffect(() => {
    if (stripe !== "return" && stripe !== "refresh") return;
    let cancelled = false;
    void (async () => {
      try {
        if (stripe === "refresh") {
          const link = await beginStripeConnect();
          if (!cancelled) window.location.assign(link.url);
          return;
        }
        const status = await refreshStripeConnect();
        if (!cancelled) {
          setNotice(
            status.chargesActive
              ? "Stripe test account is ready for payment links."
              : `Stripe card payments are ${status.cardPayments}. Finish test onboarding before sending a link.`,
          );
          await queryClient.invalidateQueries({ queryKey: ["integrations-overview"] });
        }
      } catch (error) {
        if (!cancelled) toast.error(errorMessage(error));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [stripe, queryClient]);

  async function withBusy(key: string, task: () => Promise<void>) {
    setBusy(key);
    try {
      await task();
      await queryClient.invalidateQueries({ queryKey: ["integrations-overview"] });
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setBusy(null);
    }
  }

  const snapshot = (overview.data as IntegrationsSnapshot | undefined) ?? emptySnapshot();

  return (
    <div className="pb-8">
      <ScreenHeader
        title="Integrations"
        subtitle="Jobber, Housecall Pro, reviews, payments, and porting"
      />
      <PullToRefresh onRefresh={() => overview.refetch()} />
      {overview.isLoading ? (
        <div className="px-4 py-4">
          <ListSkeleton rows={4} />
        </div>
      ) : overview.isError ? (
        <div className="px-4 py-4">
          <ErrorState
            title="Couldn't load integrations"
            description="Something went wrong reading connection status. Try again in a moment."
            onRetry={() => void overview.refetch()}
          />
        </div>
      ) : (
        <IntegrationsPage
          snapshot={snapshot}
          busy={busy}
          notice={notice}
          onConnectJobber={() =>
            withBusy("jobber", async () => {
              const started = await beginJobberConnect();
              window.location.assign(started.authorizationUrl);
            })
          }
          onDisconnectJobber={() =>
            withBusy("jobber", async () => {
              await disconnectJobberAccount();
              toast.success("Jobber disconnected.");
            })
          }
          onSaveHousecall={(apiKey) =>
            withBusy("housecall", async () => {
              await saveHousecallApiKey({ data: { apiKey } });
              toast.success("Housecall Pro API key saved.");
            })
          }
          onDisconnectHousecall={() =>
            withBusy("housecall", async () => {
              await disconnectHousecallAccount();
              toast.success("Housecall Pro disconnected.");
            })
          }
          onSaveReviews={(input: ReviewSettingsInput) =>
            withBusy("reviews", async () => {
              await saveReviewRequestSettings({ data: input });
              toast.success("Review settings saved.");
            })
          }
          onConnectStripe={() =>
            withBusy("stripe", async () => {
              const link = await beginStripeConnect();
              window.location.assign(link.url);
            })
          }
          onRefreshStripe={() =>
            withBusy("stripe", async () => {
              const status = await refreshStripeConnect();
              setNotice(
                status.chargesActive
                  ? "Card payments are active in test mode."
                  : `Card payments are ${status.cardPayments}.`,
              );
            })
          }
          onSavePortDraft={async (draft: PortDraft, bill) => {
            setBusy("port");
            try {
              return await savePortInDraft({ data: { draft, bill } });
            } catch (error) {
              toast.error(errorMessage(error));
              throw error;
            } finally {
              setBusy(null);
            }
          }}
          onConfirmPort={async (portId) => {
            setBusy("port");
            try {
              const result = await confirmPortInSubmit({ data: { portId, confirmed: true } });
              await queryClient.invalidateQueries({ queryKey: ["integrations-overview"] });
              return { submitted: result.submitted, reason: result.reason };
            } catch (error) {
              toast.error(errorMessage(error));
              throw error;
            } finally {
              setBusy(null);
            }
          }}
        />
      )}
    </div>
  );
}
