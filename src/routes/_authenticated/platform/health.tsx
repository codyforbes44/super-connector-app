import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2 } from "lucide-react";
import { useState } from "react";

import { AsyncList, Empty, Screen, StatusPill } from "@/components/screen";
import { Button } from "@/components/ui/button";
import { formatPhone } from "@/lib/format";
import { platformHealth } from "@/lib/platform.functions";

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
    <Screen className="space-y-3" onRefresh={() => qc.invalidateQueries({ queryKey: ["platform", "health"] })}>
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
