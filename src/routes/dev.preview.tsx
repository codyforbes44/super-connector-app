import { createFileRoute, redirect } from "@tanstack/react-router";
import { StickyNote } from "lucide-react";

import { ScreenHeader } from "@/components/AppShell";
import { IntegrationsPage } from "@/components/integrations/IntegrationsPage";
import { ThreadTradeActions } from "@/components/integrations/ThreadTradeActions";
import type { IntegrationsSnapshot } from "@/components/integrations/types";
import { reviewRequestBody } from "@/lib/integrations/automated-text";
import { HOUSECALL_MAX_PLAN_COPY } from "@/lib/integrations/housecall";
import { formatUsd } from "@/lib/integrations/stripe-connect";

const SCREENS = ["integrations", "jobber", "thread", "payment", "port"] as const;
type PreviewScreen = (typeof SCREENS)[number];

export const Route = createFileRoute("/dev/preview")({
  validateSearch: (search: Record<string, unknown>): { screen: PreviewScreen } => {
    const value = search["screen"];
    const raw = typeof value === "string" ? value : "integrations";
    const screen = (SCREENS as readonly string[]).includes(raw)
      ? (raw as PreviewScreen)
      : "integrations";
    return { screen };
  },
  beforeLoad: () => {
    if (import.meta.env.PROD) throw redirect({ to: "/" });
  },
  head: () => ({
    meta: [{ title: "Preview — SixVox" }, { name: "robots", content: "noindex" }],
  }),
  component: DevPreview,
});

const BASE: IntegrationsSnapshot = {
  registeredTextingNumber: "+15807450045",
  jobber: { configured: true, connected: false, accountName: null },
  housecall: { connected: false, keyHint: null, maxPlanCopy: HOUSECALL_MAX_PLAN_COPY },
  reviews: {
    reviewUrl: "https://g.page/r/example-review",
    businessName: "Forbes Plumbing",
    enabled: true,
    cooldownDays: 90,
    quietStart: "21:00",
    quietEnd: "08:00",
    timezone: "America/Chicago",
  },
  connect: {
    configured: true,
    accountId: "acct_test_sixvox",
    cardPayments: "active",
    chargesActive: true,
    label: "Forbes Plumbing",
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

function snapshotFor(screen: PreviewScreen): IntegrationsSnapshot {
  if (screen === "jobber") {
    return {
      ...BASE,
      jobber: { configured: true, connected: true, accountName: "Forbes Plumbing" },
    };
  }
  return BASE;
}

function DevPreview() {
  const { screen } = Route.useSearch();
  if (screen === "thread" || screen === "payment") return <ThreadPreview screen={screen} />;
  return (
    <div className="mx-auto min-h-dvh max-w-3xl bg-background pb-10">
      <ScreenHeader title="Integrations" subtitle="Preview of connection settings" />
      <IntegrationsPage
        snapshot={snapshotFor(screen)}
        busy={null}
        notice={null}
        onConnectJobber={() => undefined}
        onDisconnectJobber={() => undefined}
        onSaveHousecall={() => undefined}
        onDisconnectHousecall={() => undefined}
        onSaveReviews={() => undefined}
        onConnectStripe={() => undefined}
        onRefreshStripe={() => undefined}
        onSavePortDraft={async () => ({ id: "preview-port" })}
        onConfirmPort={async () => ({
          submitted: false,
          reason:
            "Live port-in submission is turned off (PORT_IN_LIVE is not true). Nothing was sent to Twilio. Forwarding stays in place.",
        })}
      />
    </div>
  );
}

function ThreadPreview({ screen }: { screen: "thread" | "payment" }) {
  const review = reviewRequestBody({
    businessName: "Forbes Plumbing",
    reviewUrl: "https://g.page/r/example-review",
  });
  return (
    <div className="mx-auto flex min-h-dvh max-w-3xl flex-col bg-background">
      <ScreenHeader title="Alex Rivera" subtitle="+1 580 555 0142" />
      <div className="flex-1 space-y-3 px-4 py-4">
        <Bubble mine={false} body="The water heater is leaking under the house." time="2:10 PM" />
        {screen === "thread" ? (
          <Bubble mine body={review} time="4:40 PM" status="sent" />
        ) : (
          <Bubble mine note body={`Payment received · ${formatUsd(12500)}.`} time="4:52 PM" />
        )}
      </div>
      <ThreadTradeActions
        conversationId="preview-conversation"
        contactName="Alex Rivera"
        contactNumber="+15805550142"
        optedOut={false}
        textingReady
        appNumber="+15807450045"
        summary="Water heater leaking under the house. Customer wants a replacement quote."
        jobStatus={screen === "thread" ? "done" : null}
        preview
        initialPanel={screen === "payment" ? "payment" : null}
      />
    </div>
  );
}

function Bubble({
  mine,
  note,
  body,
  time,
  status,
}: {
  mine?: boolean;
  note?: boolean;
  body: string;
  time: string;
  status?: string;
}) {
  return (
    <div className={mine || note ? "flex justify-end" : "flex justify-start"}>
      <div
        className={
          note
            ? "max-w-[80%] rounded-3xl border border-dashed border-primary/50 bg-primary/10 px-4 py-2.5 text-sm"
            : mine
              ? "key-signal max-w-[80%] rounded-3xl rounded-br-lg px-4 py-2.5 text-sm"
              : "glass-panel max-w-[80%] rounded-3xl rounded-bl-lg px-4 py-2.5 text-sm"
        }
      >
        {note ? (
          <p className="mb-1 flex items-center gap-1 text-[0.65rem] font-semibold tracking-wide text-primary uppercase">
            <StickyNote className="h-3 w-3" /> Internal note
          </p>
        ) : null}
        <p className="whitespace-pre-wrap">{body}</p>
        <p className="mt-1 text-[0.65rem] opacity-70">
          {time}
          {status ? ` · ${status}` : ""}
        </p>
      </div>
    </div>
  );
}
