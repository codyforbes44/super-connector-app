import { useQuery } from "@tanstack/react-query";
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  Download,
  ExternalLink,
  Loader2,
  Receipt,
  RefreshCw,
  XCircle,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { getBillingHistory, type BillingTimelineEvent } from "@/lib/payments.functions";
import { getStripeEnvironment, paymentsConfigured } from "@/lib/stripe";
import { cn } from "@/lib/utils";

const KIND_META: Record<
  BillingTimelineEvent["kind"],
  { icon: typeof Clock; tone: string; label: string }
> = {
  created: { icon: Receipt, tone: "text-muted-foreground", label: "Started" },
  trialing: { icon: Clock, tone: "text-primary", label: "Trialing" },
  active: { icon: CheckCircle2, tone: "text-success", label: "Active" },
  payment: { icon: CheckCircle2, tone: "text-success", label: "Paid" },
  past_due: { icon: AlertTriangle, tone: "text-destructive", label: "Past due" },
  canceled: { icon: XCircle, tone: "text-destructive", label: "Canceled" },
  renewal: { icon: RefreshCw, tone: "text-primary", label: "Renews" },
};

function formatDate(value: string | null): string {
  if (!value) return "—";
  return new Date(value).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function BillingHistory() {
  const configured = paymentsConfigured();
  const query = useQuery({
    queryKey: ["billing-history"],
    enabled: configured,
    queryFn: async () => getBillingHistory({ data: { environment: getStripeEnvironment() } }),
  });

  if (!configured) return null;

  if (query.isLoading) {
    return (
      <div className="glass-panel flex items-center justify-center rounded-3xl p-8">
        <Loader2 className="h-5 w-5 animate-spin text-primary" />
      </div>
    );
  }

  const data = query.data;
  if (!data || "error" in data) {
    if (!data) return null;
    return (
      <div className="glass-panel rounded-3xl p-4">
        <p className="text-sm font-semibold">Billing history unavailable</p>
        <p className="mt-1 text-xs text-muted-foreground">{data.error}</p>
        <Button
          variant="secondary"
          className="mt-3 h-11 w-full rounded-full"
          onClick={() => void query.refetch()}
        >
          Try again
        </Button>
      </div>
    );
  }

  if (!data.customerId) return null;

  return (
    <div className="space-y-4">
      {data.timeline.length ? (
        <section className="glass-panel rounded-3xl p-4">
          <div className="flex items-center justify-between gap-3">
            <h2 className="font-display text-sm font-semibold">Subscription timeline</h2>
            <button
              type="button"
              onClick={() => void query.refetch()}
              className="text-[0.7rem] text-muted-foreground hover:text-foreground"
            >
              Refresh
            </button>
          </div>
          <ol className="mt-3 space-y-3">
            {data.timeline.map((event) => {
              const meta = KIND_META[event.kind];
              const Icon = meta.icon;
              return (
                <li key={event.key} className="flex items-start gap-3">
                  <span
                    className={cn(
                      "mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/5",
                      event.future && "opacity-60",
                    )}
                  >
                    <Icon className={cn("h-4 w-4", meta.tone)} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-[0.82rem] font-medium leading-snug">
                      {event.title}
                      {event.future ? (
                        <span className="ml-2 rounded-full bg-white/5 px-2 py-0.5 text-[0.62rem] uppercase tracking-wide text-muted-foreground">
                          Upcoming
                        </span>
                      ) : null}
                    </p>
                    <p className="text-[0.7rem] text-muted-foreground">
                      {formatDate(event.at)}
                      {event.detail ? ` · ${event.detail}` : ""}
                    </p>
                  </div>
                </li>
              );
            })}
          </ol>
        </section>
      ) : null}

      <section className="glass-panel rounded-3xl p-4">
        <h2 className="font-display text-sm font-semibold">Invoices & receipts</h2>
        {data.invoices.length === 0 ? (
          <p className="mt-2 text-xs text-muted-foreground">
            No invoices yet. Your first receipt appears here after the trial converts.
          </p>
        ) : (
          <ul className="mt-3 divide-y divide-white/5">
            {data.invoices.map((invoice) => (
              <li key={invoice.id} className="flex items-center gap-3 py-2.5">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[0.82rem] font-medium">
                    {invoice.currency} {invoice.amountPaid.toFixed(2)}
                    <span className="ml-2 text-[0.7rem] font-normal capitalize text-muted-foreground">
                      {invoice.status ?? "—"}
                    </span>
                  </p>
                  <p className="truncate text-[0.7rem] text-muted-foreground">
                    {formatDate(invoice.created)}
                    {invoice.number ? ` · ${invoice.number}` : ""}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  {invoice.hostedInvoiceUrl ? (
                    <a
                      href={invoice.hostedInvoiceUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label="View invoice"
                      className="flex h-10 w-10 items-center justify-center rounded-full bg-white/5 text-muted-foreground hover:text-foreground"
                    >
                      <ExternalLink className="h-4 w-4" />
                    </a>
                  ) : null}
                  {invoice.pdfUrl ? (
                    <a
                      href={invoice.pdfUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label="Download receipt PDF"
                      className="flex h-10 w-10 items-center justify-center rounded-full bg-white/5 text-muted-foreground hover:text-foreground"
                    >
                      <Download className="h-4 w-4" />
                    </a>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
