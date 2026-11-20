import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2 } from "lucide-react";
import { useState } from "react";

import { AsyncList, Empty, Screen, StatusPill } from "@/components/screen";
import { Button } from "@/components/ui/button";
import { formatPhone } from "@/lib/format";
import { platformHealth, platformNumberHealth } from "@/lib/platform.functions";

export const Route = createFileRoute("/_authenticated/platform/health")({
  head: () => ({ meta: [{ title: "Health — SixVox Platform" }, { name: "robots", content: "noindex" }] }),
  component: Health,
});

function Health() {
  const qc = useQueryClient();
  const [onlyUnattributed, setOnly] = useState(false);
  const q = useQuery({ queryKey: ["platform", "health"], queryFn: () => platformHealth(), retry: false });
  const rows = (q.data?.errors ?? []).filter((e) => !onlyUnattributed || e.unattributed);
  return (
    <Screen className="space-y-3" onRefresh={() => qc.invalidateQueries({ queryKey: ["platform"] })}>
      <NumberHealthList />
      <h2 className="pt-2 text-sm font-semibold">Recent errors and provider alerts</h2>
      <div className="flex flex-wrap items-center gap-2">
        <Button variant={onlyUnattributed ? "secondary" : "default"} className="h-11 rounded-full" onClick={() => setOnly(false)}>
          All errors
        </Button>
        <Button variant={onlyUnattributed ? "default" : "secondary"} className="h-11 rounded-full" onClick={() => setOnly(true)}>
          Not tied to a team
        </Button>
        {q.data ? (
          <span className="text-xs text-muted-foreground">{q.data.failedDeliveries} failed outbound webhook deliveries (last 50)</span>
        ) : null}
      </div>
      <AsyncList
        query={q}
        items={rows}
        className="space-y-2"
        empty={<Empty icon={CheckCircle2} title="No recent errors" description="Carrier and webhook problems show up here." />}
      >
        {(page) =>
          page.map((e) => (
            <div key={e.id} className="min-w-0 rounded-2xl border border-border bg-card p-4">
              <div className="flex flex-wrap items-center gap-1.5">
                <StatusPill tone="danger">{e.source}</StatusPill>
                {e.code ? <StatusPill>{e.code}</StatusPill> : null}
                {e.unattributed ? <StatusPill tone="warning">No team</StatusPill> : null}
                <span className="ml-auto text-xs text-muted-foreground">{new Date(e.at).toLocaleString()}</span>
              </div>
              <p className="mt-2 break-words text-sm">{e.message || "No details"}</p>
              {e.appNumber ? <p className="mt-1 text-xs text-muted-foreground tabular-nums">Number: {formatPhone(e.appNumber)}</p> : null}
            </div>
          ))
        }
      </AsyncList>
    </Screen>
  );
}

function NumberHealthList() {
  const q = useQuery({ queryKey: ["platform", "number-health"], queryFn: () => platformNumberHealth(), retry: 1 });
  const tone = { healthy: "success", attention: "warning", not_connected: "danger" } as const;
  const label = { healthy: "Healthy", attention: "Needs attention", not_connected: "Not connected" } as const;
  return (
    <section aria-labelledby="number-health" className="space-y-2">
      <h2 id="number-health" className="text-sm font-semibold">Number health</h2>
      <AsyncList
        query={q}
        items={q.data ?? []}
        className="space-y-2"
        empty={<Empty icon={CheckCircle2} title="No numbers yet" description="Numbers added to SixVox appear here." />}
      >
        {(page) =>
          page.map((n) => (
            <div key={n.number} className="flex min-w-0 flex-wrap items-center gap-2 rounded-2xl border border-border bg-card p-4">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium tabular-nums">{formatPhone(n.number)}{n.label && n.label.replace(/\D/g, "").slice(-10) !== n.number.replace(/\D/g, "").slice(-10) ? <span className="text-muted-foreground"> · {n.label}</span> : null}</p>
                <p className="text-xs text-muted-foreground">
                  {n.reason} · Last activity {n.lastActivity ? new Date(n.lastActivity).toLocaleString() : "none in 30 days"}
                </p>
              </div>
              <StatusPill tone={tone[n.status]}>{label[n.status]}</StatusPill>
            </div>
          ))
        }
      </AsyncList>
    </section>
  );
}
