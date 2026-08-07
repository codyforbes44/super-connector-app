import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { AlertTriangle, Check, CircleSlash, Loader2, Plug, ChevronRight } from "lucide-react";

import { EmptyState, ScreenHeader } from "@/components/AppShell";
import { DeviceAccess } from "@/components/DeviceAccess";
import { Button } from "@/components/ui/button";
import { getConnectorsOverview } from "@/lib/connectors.functions";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/connectors")({
  head: () => ({
    meta: [
      { title: "Connectors — SixVox" },
      {
        name: "description",
        content: "See what's connected to your SixVox workspace and finish setup step by step.",
      },
      { property: "og:title", content: "Connectors — SixVox" },
      {
        property: "og:description",
        content: "See what's connected to your SixVox workspace and finish setup step by step.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ConnectorsScreen,
});

const STATE_STYLES = {
  connected: { label: "Connected", className: "bg-primary/15 text-primary", Icon: Check },
  action: { label: "Action needed", className: "bg-amber-400/15 text-amber-300", Icon: AlertTriangle },
  unavailable: {
    label: "Unavailable",
    className: "bg-muted text-muted-foreground",
    Icon: CircleSlash,
  },
} as const;

function ConnectorsScreen() {
  const overview = useQuery({
    queryKey: ["connectors-overview"],
    queryFn: () => getConnectorsOverview(),
  });

  const data = overview.data;
  const nextStep = data?.steps.find((step) => !step.done) ?? null;
  const doneCount = data?.steps.filter((step) => step.done).length ?? 0;
  const progress = data?.steps.length ? Math.round((doneCount / data.steps.length) * 100) : 0;

  return (
    <div className="pb-8">
      <ScreenHeader
        title="Connectors"
        subtitle={
          data
            ? `${data.summary.connected} of ${data.summary.total} services connected`
            : "Checking your integrations…"
        }
      />

      {overview.isLoading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="size-5 animate-spin text-muted-foreground" />
        </div>
      ) : overview.isError ? (
        <EmptyState
          icon={Plug}
          title="Couldn't load connectors"
          description="Something went wrong reading your integration status. Try again in a moment."
          action={
            <Button className="rounded-full" onClick={() => overview.refetch()}>
              Retry
            </Button>
          }
        />
      ) : data ? (
        <div className="space-y-6 px-4 py-4">
          <DeviceAccess />
          <section className="glass-panel space-y-4 rounded-3xl p-5">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="font-display text-base font-semibold">Setup progress</p>
                <p className="text-xs text-muted-foreground">
                  {nextStep
                    ? `Next up: ${nextStep.title.toLowerCase()}`
                    : "Everything's connected — nice work."}
                </p>
              </div>
              <span className="text-sm font-semibold text-primary">{progress}%</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-white/5">
              <div
                className="h-full rounded-full bg-primary transition-all"
                style={{ width: `${progress}%` }}
              />
            </div>

            <ol className="space-y-2">
              {data.steps.map((step, index) => {
                const active = nextStep?.id === step.id;
                return (
                  <li
                    key={step.id}
                    className={cn(
                      "rounded-2xl border p-3 transition-colors",
                      active
                        ? "border-primary/40 bg-primary/5"
                        : "border-white/5 bg-white/[0.02]",
                    )}
                  >
                    <div className="flex items-start gap-3">
                      <span
                        className={cn(
                          "mt-0.5 grid size-6 shrink-0 place-items-center rounded-full text-[0.7rem] font-semibold",
                          step.done
                            ? "bg-primary/20 text-primary"
                            : "bg-white/5 text-muted-foreground",
                        )}
                      >
                        {step.done ? <Check className="size-3.5" /> : index + 1}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p
                          className={cn(
                            "text-sm font-semibold",
                            step.done && "text-muted-foreground line-through",
                          )}
                        >
                          {step.title}
                        </p>
                        {!step.done ? (
                          <p className="mt-0.5 text-xs text-muted-foreground">{step.body}</p>
                        ) : null}
                        {!step.done ? (
                          <Button
                            asChild
                            size="sm"
                            variant={active ? "default" : "secondary"}
                            className="mt-3 rounded-full"
                          >
                            <Link to={step.href}>{step.cta}</Link>
                          </Button>
                        ) : null}
                      </div>
                    </div>
                  </li>
                );
              })}
            </ol>
          </section>

          <section className="space-y-2">
            <h2 className="px-1 text-[0.7rem] font-semibold uppercase tracking-wider text-muted-foreground">
              All connections
            </h2>
            <ul className="space-y-2">
              {data.connectors.map((connector) => {
                const style = STATE_STYLES[connector.state];
                const StatusIcon = style.Icon;
                const body = (
                  <>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="truncate text-sm font-semibold">{connector.name}</p>
                        <span className="rounded-full bg-white/5 px-2 py-0.5 text-[0.6rem] uppercase tracking-wide text-muted-foreground">
                          {connector.category}
                        </span>
                      </div>
                      <p className="mt-0.5 truncate text-xs text-muted-foreground">
                        {connector.detail}
                      </p>
                    </div>
                    <span
                      className={cn(
                        "flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-[0.65rem] font-semibold",
                        style.className,
                      )}
                    >
                      <StatusIcon className="size-3" />
                      {style.label}
                    </span>
                    {connector.href ? (
                      <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
                    ) : null}
                  </>
                );
                return (
                  <li key={connector.id}>
                    {connector.href ? (
                      <Link
                        to={connector.href}
                        className="glass-panel flex items-center gap-3 rounded-2xl px-4 py-3 active:scale-[0.99]"
                      >
                        {body}
                      </Link>
                    ) : (
                      <div className="glass-panel flex items-center gap-3 rounded-2xl px-4 py-3">
                        {body}
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          </section>
        </div>
      ) : null}
    </div>
  );
}