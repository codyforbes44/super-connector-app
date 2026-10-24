import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ScrollText } from "lucide-react";

import { AsyncList, Empty, Screen } from "@/components/screen";
import { platformAudit } from "@/lib/platform.functions";

export const Route = createFileRoute("/_authenticated/platform/audit")({
  head: () => ({ meta: [{ title: "Audit log — SixVox Platform" }, { name: "robots", content: "noindex" }] }),
  component: Audit,
});

function Audit() {
  const q = useQuery({ queryKey: ["platform", "audit"], queryFn: () => platformAudit(), retry: false });
  return (
    <Screen className="space-y-3">
      <AsyncList query={q} items={q.data ?? []} className="space-y-2" empty={<Empty icon={ScrollText} title="No actions logged yet" />}>
        {(page) =>
          page.map((r) => (
            <div key={r.id} className="min-w-0 rounded-2xl border border-border bg-card p-4">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <p className="font-mono text-xs font-semibold text-primary">{r.action}</p>
                <span className="text-xs text-muted-foreground">{new Date(r.at).toLocaleString()}</span>
              </div>
              <p className="mt-1 truncate text-sm">{r.actor}</p>
              <p className="mt-1 break-all font-mono text-[0.7rem] text-muted-foreground">{r.detail}</p>
            </div>
          ))
        }
      </AsyncList>
    </Screen>
  );
}
