import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Building2 } from "lucide-react";
import { useState } from "react";

import { AsyncList, Empty, Screen, StatusPill } from "@/components/screen";
import { Input } from "@/components/ui/input";
import { formatPhone } from "@/lib/format";
import { platformWorkspaces } from "@/lib/platform.functions";

export const Route = createFileRoute("/_authenticated/platform/workspaces")({
  head: () => ({ meta: [{ title: "Teams — SixVox Platform" }, { name: "robots", content: "noindex" }] }),
  component: Workspaces,
});

function Workspaces() {
  const [term, setTerm] = useState("");
  const q = useQuery({ queryKey: ["platform", "workspaces"], queryFn: () => platformWorkspaces(), retry: false });
  const t = term.trim().toLowerCase();
  const rows = (q.data ?? []).filter(
    (w) => !t || w.name.toLowerCase().includes(t) || w.ownerEmail.toLowerCase().includes(t) || w.numbers.some((n) => n.includes(t)),
  );
  return (
    <Screen className="space-y-3">
      <Input value={term} onChange={(e) => setTerm(e.target.value)} placeholder="Search team, owner or number" className="h-11 rounded-xl" />
      <AsyncList
        query={q}
        items={rows}
        className="grid gap-3 md:grid-cols-2"
        empty={<Empty icon={Building2} title="No teams yet" />}
      >
        {(page) =>
          page.map((w) => (
            <div key={w.id} className="min-w-0 rounded-2xl border border-border bg-card p-4">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate font-display text-sm font-semibold">{w.name}</p>
                  <p className="truncate text-xs text-muted-foreground">{w.ownerEmail || "No owner"}</p>
                </div>
                <StatusPill tone={w.a2pStatus === "approved" ? "success" : "neutral"}>
                  Texting: {w.a2pStatus ?? "not set"}
                </StatusPill>
              </div>
              <p className="mt-2 text-xs text-muted-foreground">
                {w.seats} {w.seats === 1 ? "member" : "members"} · {w.numbers.length} {w.numbers.length === 1 ? "number" : "numbers"}
              </p>
              {w.numbers.length ? (
                <p className="mt-1 truncate text-xs tabular-nums">{w.numbers.map((n) => formatPhone(n)).join(", ")}</p>
              ) : null}
            </div>
          ))
        }
      </AsyncList>
    </Screen>
  );
}
