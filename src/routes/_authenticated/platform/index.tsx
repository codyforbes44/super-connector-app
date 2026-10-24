import { Link, createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import { ErrorState, ListSkeleton, Screen } from "@/components/screen";
import { errorMessage } from "@/lib/format";
import { platformOverview } from "@/lib/platform.functions";

export const Route = createFileRoute("/_authenticated/platform/")({
  head: () => ({ meta: [{ title: "Overview — SixVox Platform" }, { name: "robots", content: "noindex" }] }),
  component: Overview,
});

function Stat({ label, value, hint, to }: { label: string; value: string | number; hint?: string; to?: string }) {
  const body = (
    <div className="h-full rounded-2xl border border-border bg-card p-4">
      <p className="eyebrow text-[0.68rem] text-muted-foreground">{label}</p>
      <p className="mt-1 font-display text-2xl font-semibold tabular-nums">{value}</p>
      {hint ? <p className="mt-1 text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
  return to ? (
    <Link to={to} className="block rounded-2xl focus-visible:ring-2 focus-visible:ring-ring">
      {body}
    </Link>
  ) : (
    body
  );
}

function Overview() {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["platform", "overview"], queryFn: () => platformOverview(), retry: false });

  return (
    <Screen className="space-y-6" onRefresh={() => qc.invalidateQueries({ queryKey: ["platform"] })}>
      {q.isPending ? <ListSkeleton rows={4} /> : null}
      {q.error ? <ErrorState description={errorMessage(q.error)} onRetry={() => q.refetch()} /> : null}
      {q.data ? (
        <>
          <section aria-label="Revenue and accounts" className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <Stat label="Est. MRR" value={`$${q.data.mrr.toLocaleString()}`} hint="Paying monthly-equivalent" />
            <Stat label="Accounts" value={q.data.accounts} to="/platform/accounts" />
            <Stat label="Teams" value={q.data.workspaces} to="/platform/workspaces" />
            <Stat label="Numbers" value={q.data.numbers} to="/platform/numbers" />
          </section>
          <section aria-label="Subscriptions" className="grid grid-cols-2 gap-3 md:grid-cols-5">
            <Stat label="Paying" value={q.data.active} />
            <Stat label="Trialing" value={q.data.trialing} />
            <Stat label="Comped" value={q.data.comped} />
            <Stat label="Past due" value={q.data.pastDue} />
            <Stat label="Suspended" value={q.data.suspended} />
          </section>
          <section aria-label="Activity" className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <Stat label="Calls 24h" value={q.data.calls24} hint={`${q.data.calls7} in 7 days`} />
            <Stat label="Texts 24h" value={q.data.msgs24} hint={`${q.data.msgs7} in 7 days`} />
            <Stat
              label="Errors 7d"
              value={q.data.errors7}
              hint={`${q.data.unattributed} not tied to a team`}
              to="/platform/health"
            />
            <Stat label="Open leads" value={q.data.openLeads} hint="Website concierge" to="/platform/ai" />
          </section>
        </>
      ) : null}
    </Screen>
  );
}
