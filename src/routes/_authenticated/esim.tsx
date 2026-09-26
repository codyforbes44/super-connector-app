import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Check, Copy, Globe2, Loader2, QrCode, RefreshCw, Signal, Wifi } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { ScreenHeader } from "@/components/AppShell";
import { AsyncList, Empty, ListGroup, Screen, Section } from "@/components/screen";
import { EsimCheckout } from "@/components/esim/EsimCheckout";
import { PaymentTestModeBanner } from "@/components/PaymentTestModeBanner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import type { EsimOrder } from "@/lib/esim.server";
import { errorMessage } from "@/lib/format";
import { esimUsage, finalizeEsimOrder, listEsimPackages, listMyEsims } from "@/lib/esim.functions";
import { getStripeEnvironment, paymentsConfigured } from "@/lib/stripe";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/esim")({
  validateSearch: (search: Record<string, unknown>): { esim_order?: string } => {
    const id = typeof search["esim_order"] === "string" ? search["esim_order"] : undefined;
    return id ? { esim_order: id } : {};
  },
  head: () => ({
    meta: [
      { title: "Travel data eSIM — SixVox" },
      {
        name: "description",
        content:
          "Buy a travel data eSIM inside SixVox and keep your line ringing abroad without roaming fees.",
      },
      { property: "og:title", content: "Travel data eSIM — SixVox" },
      {
        property: "og:description",
        content: "Data plans for 190+ destinations, installed straight from your phone.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: EsimScreen,
});

const money = (cents: number) => `$${(cents / 100).toFixed(2)}`;

function EsimScreen() {
  const { esim_order: returnedOrder } = Route.useSearch();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [query, setQuery] = useState("");
  const [buying, setBuying] = useState<string | null>(null);
  const [detail, setDetail] = useState<string | null>(null);

  const catalogue = useQuery({
    queryKey: ["esim-packages"],
    queryFn: () => listEsimPackages(),
    retry: false,
  });
  const orders = useQuery({
    queryKey: ["esim-orders"],
    queryFn: () => listMyEsims(),
    retry: false,
  });

  const finalize = useMutation({
    mutationFn: (orderId: string) =>
      finalizeEsimOrder({ data: { orderId, environment: getStripeEnvironment() } }),
    onSuccess: async (raw) => {
      const result = raw as { order: Order | null; error: string | null };
      await queryClient.invalidateQueries({ queryKey: ["esim-orders"] });
      if (result.error) toast.error(result.error);
      else {
        toast.success("Your eSIM is ready to install.");
        if (result.order) setDetail(result.order.id);
      }
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  // Coming back from Stripe: confirm payment and provision the profile.
  useEffect(() => {
    if (!returnedOrder) return;
    finalize.mutate(returnedOrder);
    void navigate({ to: "/esim", search: {}, replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [returnedOrder]);

  const packages = catalogue.data?.packages ?? [];
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = q
      ? packages.filter(
          (p) =>
            p.region.toLowerCase().includes(q) ||
            p.title.toLowerCase().includes(q) ||
            (p.countryCode ?? "").toLowerCase().includes(q),
        )
      : packages;
    return list;
  }, [packages, query]);

  const mine = (orders.data ?? []) as unknown as Order[];
  const openOrder = mine.find((o) => o.id === detail) ?? null;

  const refresh = async () => {
    await Promise.all([catalogue.refetch(), orders.refetch()]);
  };

  return (
    <div className="pb-6">
      <ScreenHeader
        title="Travel data"
        subtitle="Add a data eSIM so SixVox keeps working abroad"
        action={
          <Button
            size="icon"
            variant="ghost"
            onClick={() => {
              void catalogue.refetch();
              void orders.refetch();
            }}
          >
            <RefreshCw className={cn("h-4 w-4", catalogue.isFetching && "animate-spin")} />
            <span className="sr-only">Refresh</span>
          </Button>
        }
      />

      <PaymentTestModeBanner />

      <Screen className="px-3 sm:px-3" onRefresh={refresh}>
        {finalize.isPending ? (
          <p className="mt-3 flex items-center gap-2 rounded-2xl border border-border bg-card px-3.5 py-3 text-xs">
            <Loader2 className="h-4 w-4 animate-spin text-primary" />
            Confirming your payment and preparing the eSIM…
          </p>
        ) : null}

        {mine.length > 0 ? (
          <Section title="Your data plans">
            <ul className="space-y-2">
              {mine.map((order) => (
                <li key={order.id}>
                  <button
                    type="button"
                    onClick={() => setDetail(order.id)}
                    className="flex w-full items-center gap-3 rounded-2xl border border-border bg-card px-4 py-3 text-left"
                  >
                    <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary/15">
                      <Signal className="size-4 text-primary" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold">
                        {order.package_title}
                      </span>
                      <span className="block truncate text-xs text-muted-foreground">
                        {order.data_amount} · {order.validity_days} days ·{" "}
                        {money(order.amount_cents)}
                      </span>
                    </span>
                    <Badge
                      variant={order.status === "active" ? "secondary" : "outline"}
                      className="shrink-0 text-[0.6rem]"
                    >
                      {order.status}
                    </Badge>
                  </button>
                </li>
              ))}
            </ul>
          </Section>
        ) : null}

        <Section title="Data plans" className="space-y-3">
          {!catalogue.data?.configured ? (
            <div className="rounded-2xl border border-border bg-card p-4 text-xs text-muted-foreground">
              <p className="text-sm font-semibold text-foreground">
                Data plans aren&apos;t live yet
              </p>
              <p className="mt-1">
                Everything is built and waiting — plan browsing, card payment and instant delivery
                of the install QR code. Add the eSIM partner credentials and this storefront fills
                itself in automatically.
              </p>
            </div>
          ) : (
            <>
              <Input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search a country or region"
                className="h-12 rounded-xl px-4 text-base"
                inputMode="search"
              />
              {catalogue.data.error ? (
                <p className="text-xs text-destructive">{catalogue.data.error}</p>
              ) : null}
              <AsyncList
                query={catalogue}
                items={filtered}
                skeletonRows={6}
                className="mt-2"
                errorTitle="Couldn't load data plans"
                empty={
                  <Empty
                    icon={Globe2}
                    title="No plans match"
                    description="Try a different country, region or 'global'."
                  />
                }
              >
                {(page) => (
                  <ul className="space-y-2">
                    {page.map((pkg) => (
                      <li
                        key={pkg.id}
                        className="flex items-center gap-3 rounded-2xl border border-border bg-card px-4 py-3"
                      >
                        <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary/15">
                          <Wifi className="size-4 text-primary" />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-semibold">{pkg.region}</span>
                          <span className="block truncate text-xs text-muted-foreground">
                            {pkg.data} · {pkg.validityDays} days · {pkg.operator}
                          </span>
                        </span>
                        <Button
                          size="sm"
                          className="h-10 shrink-0 rounded-xl px-4 font-semibold"
                          disabled={!paymentsConfigured()}
                          onClick={() => setBuying(pkg.id)}
                        >
                          {money(pkg.priceCents)}
                        </Button>
                      </li>
                    ))}
                  </ul>
                )}
              </AsyncList>
            </>
          )}
        </Section>
      </Screen>

      {buying ? (
        <Sheet open onOpenChange={(v) => !v && setBuying(null)}>
          <SheetContent
            side="bottom"
            className="app-gradient max-h-[92dvh] overflow-y-auto rounded-t-[2rem] border-border"
          >
            <SheetHeader className="px-0">
              <SheetTitle className="font-display">Checkout</SheetTitle>
            </SheetHeader>
            <div className="pb-[env(safe-area-inset-bottom)]">
              <EsimCheckout packageId={buying} />
            </div>
          </SheetContent>
        </Sheet>
      ) : null}

      {openOrder ? (
        <OrderSheet
          key={openOrder.id}
          order={openOrder}
          onClose={() => setDetail(null)}
          onRetry={() => finalize.mutate(openOrder.id)}
          retrying={finalize.isPending}
        />
      ) : null}
    </div>
  );
}

type Order = EsimOrder;

function OrderSheet({
  order,
  onClose,
  onRetry,
  retrying,
}: {
  order: Order;
  onClose: () => void;
  onRetry: () => void;
  retrying: boolean;
}) {
  const usage = useQuery({
    queryKey: ["esim-usage", order.id],
    queryFn: () => esimUsage({ data: { orderId: order.id } }),
    enabled: order.status === "active" && Boolean(order.iccid),
    retry: false,
  });

  const appleUrl = order.instructions?.appleInstallUrl ?? null;

  async function copy(value: string, label: string) {
    try {
      await navigator.clipboard.writeText(value);
      toast.success(`${label} copied.`);
    } catch {
      toast.error("Couldn't copy — long-press to select instead.");
    }
  }

  return (
    <Sheet open onOpenChange={(v) => !v && onClose()}>
      <SheetContent
        side="bottom"
        className="app-gradient max-h-[92dvh] overflow-y-auto rounded-t-[2rem] border-border"
      >
        <SheetHeader className="px-0">
          <SheetTitle className="font-display">{order.package_title}</SheetTitle>
        </SheetHeader>

        <div className="space-y-4 pb-[env(safe-area-inset-bottom)]">
          <p className="text-xs text-muted-foreground">
            {order.data_amount} · {order.validity_days} days · {order.region}
          </p>

          {order.status !== "active" ? (
            <div className="glass-panel rounded-2xl p-3.5 text-xs">
              <p className="text-sm font-semibold">
                {order.status === "failed" ? "Something went wrong" : "Preparing your eSIM"}
              </p>
              <p className="mt-1 text-muted-foreground">
                {order.last_error ?? "This usually takes a few seconds."}
              </p>
              <Button
                variant="secondary"
                className="mt-3 h-10 rounded-xl"
                onClick={onRetry}
                disabled={retrying}
              >
                {retrying ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Try again
              </Button>
            </div>
          ) : (
            <>
              {order.qr_code_url ? (
                <div className="grid place-items-center rounded-3xl bg-white p-4">
                  <img
                    src={order.qr_code_url}
                    alt={`Install QR code for ${order.package_title}`}
                    width={220}
                    height={220}
                    loading="lazy"
                    className="size-[220px] object-contain"
                  />
                </div>
              ) : null}

              {appleUrl ? (
                <a
                  href={appleUrl}
                  className="key-signal flex h-12 w-full items-center justify-center rounded-xl text-sm font-semibold"
                >
                  <QrCode className="mr-2 h-4 w-4" />
                  Install on this iPhone
                </a>
              ) : null}

              <div className="space-y-2">
                {(
                  [
                    ["SM-DP+ address", order.smdp_address],
                    ["Activation code", order.matching_id ?? order.activation_code],
                    ["APN", order.apn],
                    ["ICCID", order.iccid],
                  ] as Array<[string, string | null]>
                )
                  .filter(([, value]) => Boolean(value))
                  .map(([label, value]) => (
                    <button
                      key={label}
                      type="button"
                      onClick={() => copy(String(value), label)}
                      className="glass-panel flex w-full items-center gap-3 rounded-2xl px-3.5 py-2.5 text-left"
                    >
                      <span className="min-w-0 flex-1">
                        <span className="block text-[0.65rem] tracking-wide text-muted-foreground uppercase">
                          {label}
                        </span>
                        <span className="tabular block truncate text-sm">{String(value)}</span>
                      </span>
                      <Copy className="size-4 shrink-0 text-muted-foreground" />
                    </button>
                  ))}
              </div>

              {usage.data ? (
                <div className="glass-panel rounded-2xl px-3.5 py-3 text-xs">
                  <p className="text-[0.65rem] tracking-wide text-muted-foreground uppercase">
                    Usage
                  </p>
                  <p className="mt-1 text-sm font-semibold">
                    {usage.data.remainingMb ?? "—"} MB left
                    {usage.data.totalMb ? ` of ${usage.data.totalMb} MB` : ""}
                  </p>
                  <p className="text-muted-foreground">
                    {usage.data.status}
                    {usage.data.expiresAt ? ` · expires ${usage.data.expiresAt}` : ""}
                  </p>
                </div>
              ) : null}

              <ol className="space-y-2 text-xs text-muted-foreground">
                {[
                  "Scan the QR code with another device, or tap Install on this iPhone.",
                  "Keep your normal SIM as the voice line and set the eSIM to data only.",
                  "Turn data roaming on for the eSIM — that's what the plan pays for.",
                ].map((step, index) => (
                  <li key={step} className="flex gap-2.5">
                    <span className="key-raised grid size-5 shrink-0 place-items-center rounded-full text-[0.6rem] font-semibold text-primary">
                      {index + 1}
                    </span>
                    {step}
                  </li>
                ))}
              </ol>

              <p className="flex items-center gap-1.5 text-[0.7rem] text-muted-foreground">
                <Check className="size-3.5 text-primary" /> SixVox calls and texts run over this
                data plan — no roaming charges from your carrier.
              </p>
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
