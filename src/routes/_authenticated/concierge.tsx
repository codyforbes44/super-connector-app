import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Bot,
  CalendarClock,
  Check,
  MessageSquare,
  PhoneCall,
  RefreshCw,
  UserRoundPlus,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { ScreenHeader } from "@/components/AppShell";
import { AsyncList, Empty, Screen } from "@/components/screen";
import { Button } from "@/components/ui/button";
import { errorMessage } from "@/lib/format";
import {
  conciergeOverview,
  conciergeTranscript,
  setConciergeCallbackStatus,
  setConciergeLeadHandled,
  syncConcierge,
} from "@/lib/concierge.functions";

export const Route = createFileRoute("/_authenticated/concierge")({
  head: () => ({
    meta: [
      { title: "Concierge — SixVox" },
      {
        name: "description",
        content: "Website concierge conversations, captured leads and callback requests.",
      },
      { property: "og:title", content: "Concierge — SixVox" },
      {
        property: "og:description",
        content: "Review what Vox told visitors and follow up on every lead.",
      },
    ],
  }),
  component: ConciergeScreen,
});

type Tab = "conversations" | "leads" | "callbacks";

function ConciergeScreen() {
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<Tab>("conversations");
  const [openId, setOpenId] = useState<string | null>(null);

  const query = useQuery({
    queryKey: ["concierge"],
    queryFn: () => conciergeOverview({ data: undefined }),
    retry: false,
  });

  const refresh = () => queryClient.invalidateQueries({ queryKey: ["concierge"] });

  const sync = useMutation({
    mutationFn: () => syncConcierge({ data: undefined }),
    onSuccess: (result) =>
      toast.success(`Vox updated — ${result.tools} tools, ${result.documents} documents`),
    onError: (error) => toast.error(errorMessage(error)),
  });

  const lead = useMutation({
    mutationFn: (input: { id: string; handled: boolean }) =>
      setConciergeLeadHandled({ data: input }),
    onSuccess: () => void refresh(),
    onError: (error) => toast.error(errorMessage(error)),
  });

  const callback = useMutation({
    mutationFn: (input: { id: string; status: "pending" | "done" | "cancelled" }) =>
      setConciergeCallbackStatus({ data: input }),
    onSuccess: () => void refresh(),
    onError: (error) => toast.error(errorMessage(error)),
  });

  const data = query.data;
  const stats = data?.stats;

  return (
    <div className="min-w-0">
      <ScreenHeader
        title="Concierge"
        subtitle="Vox on sixvox.3bi.io"
        action={
          <Button variant="ghost" size="sm" disabled={sync.isPending} onClick={() => sync.mutate()}>
            <RefreshCw className={sync.isPending ? "h-4 w-4 animate-spin" : "h-4 w-4"} />
            Sync
          </Button>
        }
      />

      <Screen className="space-y-4" onRefresh={refresh}>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Stat icon={MessageSquare} label="Chats" value={stats?.conversations ?? 0} />
          <Stat icon={UserRoundPlus} label="Leads" value={stats?.leads ?? 0} />
          <Stat icon={PhoneCall} label="Callbacks" value={stats?.callbacks ?? 0} />
          <Stat icon={Bot} label="Gaps" value={stats?.unanswered ?? 0} />
        </div>

        <div className="flex gap-1 rounded-full border border-border p-1 text-xs">
          {(["conversations", "leads", "callbacks"] as Tab[]).map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => setTab(value)}
              className={
                tab === value
                  ? "flex-1 rounded-full bg-primary px-3 py-2 font-semibold text-primary-foreground capitalize"
                  : "flex-1 rounded-full px-3 py-2 text-muted-foreground capitalize"
              }
            >
              {value}
            </button>
          ))}
        </div>

        {tab === "conversations" ? (
          <AsyncList
            query={query}
            items={data?.conversations ?? []}
            empty={
              <Empty
                icon={MessageSquare}
                title="No conversations yet"
                description="Visitors who chat with Vox on the website will show up here."
              />
            }
            className="space-y-2"
          >
            {(rows) => (
              <ul className="divide-y divide-border overflow-hidden rounded-2xl border border-border">
                {rows.map((row) => (
                  <li key={row.id}>
                    <button
                      type="button"
                      onClick={() => setOpenId(openId === row.id ? null : row.id)}
                      className="w-full px-4 py-3 text-left"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <p className="truncate text-sm font-medium">
                          {row.summary ?? row.page ?? "Website chat"}
                        </p>
                        <span className="shrink-0 text-[0.65rem] text-muted-foreground">
                          {new Date(row.createdAt).toLocaleString()}
                        </span>
                      </div>
                      <p className="mt-1 flex flex-wrap gap-2 text-[0.7rem] text-muted-foreground">
                        <span className="capitalize">{row.mode}</span>
                        {row.page ? <span>{row.page}</span> : null}
                        {row.signedIn ? <span className="text-primary">signed in</span> : null}
                        {row.handoff ? <span className="text-primary">handoff</span> : null}
                        {row.outcome ? <span>{row.outcome}</span> : null}
                        {row.turns ? <span>{row.turns} turns</span> : null}
                      </p>
                      {row.unanswered.length ? (
                        <p className="mt-1 text-[0.7rem] text-destructive">
                          Unanswered: {row.unanswered.join("; ")}
                        </p>
                      ) : null}
                    </button>
                    {openId === row.id ? <Transcript conversationId={row.id} /> : null}
                  </li>
                ))}
              </ul>
            )}
          </AsyncList>
        ) : null}

        {tab === "leads" ? (
          <AsyncList
            query={query}
            items={data?.leads ?? []}
            empty={
              <Empty
                icon={UserRoundPlus}
                title="No leads yet"
                description="Vox saves a lead whenever a visitor shares their details."
              />
            }
            className="space-y-2"
          >
            {(rows) => (
              <ul className="divide-y divide-border overflow-hidden rounded-2xl border border-border">
                {rows.map((row) => (
                  <li key={row.id} className="flex items-start gap-3 px-4 py-3">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{row.name ?? "Unnamed"}</p>
                      <p className="truncate text-[0.72rem] text-muted-foreground">
                        {[row.email, row.phone, row.company].filter(Boolean).join(" · ")}
                      </p>
                      {row.need ? (
                        <p className="mt-1 text-[0.72rem] text-muted-foreground">{row.need}</p>
                      ) : null}
                      <p className="mt-1 flex gap-2 text-[0.65rem] text-muted-foreground">
                        {row.planInterest ? <span>{row.planInterest}</span> : null}
                        {row.urgency ? <span>{row.urgency}</span> : null}
                        <span>{new Date(row.createdAt).toLocaleDateString()}</span>
                      </p>
                    </div>
                    <Button
                      size="sm"
                      variant={row.handled ? "ghost" : "secondary"}
                      onClick={() => lead.mutate({ id: row.id, handled: !row.handled })}
                    >
                      <Check className="h-4 w-4" />
                      {row.handled ? "Done" : "Mark done"}
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </AsyncList>
        ) : null}

        {tab === "callbacks" ? (
          <AsyncList
            query={query}
            items={data?.callbacks ?? []}
            empty={
              <Empty
                icon={CalendarClock}
                title="No callbacks booked"
                description="Vox can book a callback window for anyone who prefers to talk."
              />
            }
            className="space-y-2"
          >
            {(rows) => (
              <ul className="divide-y divide-border overflow-hidden rounded-2xl border border-border">
                {rows.map((row) => (
                  <li key={row.id} className="flex items-start gap-3 px-4 py-3">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">
                        {row.name ?? "Visitor"} · {row.phone}
                      </p>
                      <p className="truncate text-[0.72rem] text-muted-foreground">
                        {row.window}
                        {row.timezone ? ` · ${row.timezone}` : ""}
                      </p>
                      {row.topic ? (
                        <p className="mt-1 text-[0.72rem] text-muted-foreground">{row.topic}</p>
                      ) : null}
                    </div>
                    <Button
                      size="sm"
                      variant={row.status === "done" ? "ghost" : "secondary"}
                      onClick={() =>
                        callback.mutate({
                          id: row.id,
                          status: row.status === "done" ? "pending" : "done",
                        })
                      }
                    >
                      <Check className="h-4 w-4" />
                      {row.status === "done" ? "Done" : "Mark called"}
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </AsyncList>
        ) : null}
      </Screen>
    </div>
  );
}

function Stat({ icon: Icon, label, value }: { icon: typeof Bot; label: string; value: number }) {
  return (
    <div className="rounded-2xl border border-border px-3 py-3">
      <Icon className="h-4 w-4 text-primary" />
      <p className="font-display mt-2 text-xl font-semibold">{value}</p>
      <p className="text-[0.65rem] text-muted-foreground">{label}</p>
    </div>
  );
}

function Transcript({ conversationId }: { conversationId: string }) {
  const query = useQuery({
    queryKey: ["concierge-transcript", conversationId],
    queryFn: () => conciergeTranscript({ data: { conversationId } }),
    retry: false,
  });

  if (query.isLoading) {
    return <p className="px-4 pb-3 text-xs text-muted-foreground">Loading transcript…</p>;
  }
  if (!query.data?.length) {
    return <p className="px-4 pb-3 text-xs text-muted-foreground">No transcript stored.</p>;
  }

  return (
    <div className="space-y-2 border-t border-border px-4 py-3">
      {query.data.map((turn, index) => (
        <div key={index} className="text-xs">
          <span className="text-[0.65rem] tracking-wide text-muted-foreground uppercase">
            {turn.toolName ? `tool · ${turn.toolName}` : turn.role}
          </span>
          <p className="mt-0.5 whitespace-pre-wrap">{turn.content}</p>
          {turn.toolPayload ? (
            <pre className="mt-1 max-h-40 overflow-auto rounded-lg bg-muted/40 p-2 text-[0.65rem]">
              {turn.toolPayload}
            </pre>
          ) : null}
        </div>
      ))}
    </div>
  );
}
