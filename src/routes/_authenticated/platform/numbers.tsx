import { Link, createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Hash, Lock } from "lucide-react";
import { useState } from "react";

import { ManageNumberSheet } from "@/components/platform/ManageNumberSheet";
import { Button } from "@/components/ui/button";
import { AsyncList, Empty, Screen, StatusPill } from "@/components/screen";
import { Input } from "@/components/ui/input";
import { formatPhone } from "@/lib/format";
import { platformNumbers } from "@/lib/platform.functions";

export const Route = createFileRoute("/_authenticated/platform/numbers")({
  head: () => ({ meta: [{ title: "Number fleet — SixVox Platform" }, { name: "robots", content: "noindex" }] }),
  component: Fleet,
});

function Fleet() {
  const [term, setTerm] = useState("");
  const [manage, setManage] = useState<string | null>(null);
  const q = useQuery({ queryKey: ["platform", "numbers"], queryFn: () => platformNumbers(), retry: false });
  const t = term.trim().toLowerCase();
  const rows = (q.data ?? []).filter(
    (n) => !t || n.number.includes(t.replace(/\D/g, "") || t) || n.workspace.toLowerCase().includes(t) || n.label.toLowerCase().includes(t),
  );
  return (
    <Screen className="space-y-3">
      <p className="text-sm text-muted-foreground">
        Tap Manage to move a number to another team or choose who can use it. Change call routing from{" "}
        <Link to="/numbers" className="text-primary underline-offset-4 hover:underline">Numbers</Link>.
        Locked lines answer on the AI directly on purpose and are never rewritten.
      </p>
      <Input value={term} onChange={(e) => setTerm(e.target.value)} placeholder="Search number or team" className="h-11 rounded-xl" />
      <AsyncList query={q} items={rows} className="grid gap-3 md:grid-cols-2 xl:grid-cols-3" empty={<Empty icon={Hash} title="No numbers" />}>
        {(page) =>
          page.map((n) => (
            <div key={n.id} className="min-w-0 rounded-2xl border border-border bg-card p-4">
              <div className="flex items-center justify-between gap-2">
                <p className="font-display text-sm font-semibold tabular-nums">{formatPhone(n.number)}</p>
                {n.protected ? (
                  <StatusPill tone="warning">
                    <Lock className="mr-1 h-3 w-3" aria-hidden /> Locked
                  </StatusPill>
                ) : null}
              </div>
              <p className="truncate text-xs text-muted-foreground">{n.workspace}{n.label ? ` · ${n.label}` : ""}</p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                <StatusPill tone={n.wired || n.protected ? "success" : "warning"}>
                  {n.protected ? "AI direct" : n.wired ? "Rings in app" : "Not wired"}
                </StatusPill>
                <StatusPill>Answer: {n.answerMode}</StatusPill>
                <StatusPill tone={n.textingStatus === "VERIFIED" || n.textingStatus === "approved" ? "success" : "neutral"}>
                  Texting: {n.textingStatus ?? "unknown"}
                </StatusPill>
              </div>
              {n.protected ? null : (
                <Button variant="outline" className="mt-3 h-11 w-full" onClick={() => setManage(n.id)}>Manage</Button>
              )}
            </div>
          ))
        }
      </AsyncList>
      <ManageNumberSheet id={manage} onClose={() => setManage(null)} />
    </Screen>
  );
}
