import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Gift, Loader2, ShieldCheck, UserX } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { EmptyState, ScreenHeader } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { errorMessage } from "@/lib/format";
import { listSubscribers, updateSubscriber } from "@/lib/payments.functions";
import { planByCode } from "@/lib/plans";

export const Route = createFileRoute("/_authenticated/subscribers")({
  head: () => ({
    meta: [
      { title: "Subscribers — Signalbox" },
      { name: "description", content: "Manage Signalbox subscribers, plans and access." },
    ],
  }),
  component: SubscribersScreen,
});

function SubscribersScreen() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");

  const query = useQuery({
    queryKey: ["subscribers"],
    queryFn: () => listSubscribers({ data: undefined }),
    retry: false,
  });

  const mutation = useMutation({
    mutationFn: (input: Parameters<typeof updateSubscriber>[0]["data"]) =>
      updateSubscriber({ data: input }),
    onSuccess: () => {
      toast.success("Subscriber updated");
      void queryClient.invalidateQueries({ queryKey: ["subscribers"] });
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  const term = search.trim().toLowerCase();
  const rows = (query.data ?? []).filter(
    (row) =>
      !term ||
      row.email.toLowerCase().includes(term) ||
      row.displayName.toLowerCase().includes(term),
  );

  return (
    <div className="pb-10">
      <ScreenHeader title="Subscribers" subtitle="Super admin only" />
      <div className="space-y-3 px-4 pt-4">
        <Input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search by name or email"
          className="rounded-full"
        />

        {query.isLoading ? (
          <div className="glass-panel flex justify-center rounded-3xl p-8">
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
          </div>
        ) : null}

        {query.isError ? (
          <EmptyState
            icon={ShieldCheck}
            title="Restricted"
            description="Only the super admin can view subscribers."
          />
        ) : null}

        {!query.isLoading && !query.isError && rows.length === 0 ? (
          <EmptyState icon={ShieldCheck} title="No accounts yet" description="New signups appear here." />
        ) : null}

        {rows.map((row) => {
          const sub = row.subscription as
            | { plan_code: string | null; status: string; comped: boolean; suspended: boolean }
            | null;
          const plan = planByCode(sub?.plan_code);
          return (
            <div key={row.id} className="glass-panel rounded-3xl p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-display truncate text-sm font-semibold">
                    {row.displayName || row.email}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">{row.email}</p>
                  <p className="mt-1 text-[0.7rem] text-muted-foreground">
                    {plan?.name ?? "No plan"} · {sub?.status ?? "inactive"}
                    {sub?.comped ? " · comped" : ""}
                    {sub?.suspended ? " · suspended" : ""}
                    {row.roles.length ? ` · ${row.roles.join(", ")}` : ""}
                  </p>
                </div>
              </div>
              <div className="mt-3 flex gap-2">
                <Button
                  size="sm"
                  variant="secondary"
                  className="flex-1 rounded-full"
                  disabled={mutation.isPending}
                  onClick={() =>
                    mutation.mutate({ targetUserId: row.id, comped: !(sub?.comped ?? false) })
                  }
                >
                  <Gift className="h-3.5 w-3.5" />
                  {sub?.comped ? "Remove comp" : "Comp access"}
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  className="flex-1 rounded-full"
                  disabled={mutation.isPending}
                  onClick={() =>
                    mutation.mutate({ targetUserId: row.id, suspended: !(sub?.suspended ?? false) })
                  }
                >
                  <UserX className="h-3.5 w-3.5" />
                  {sub?.suspended ? "Restore" : "Suspend"}
                </Button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}