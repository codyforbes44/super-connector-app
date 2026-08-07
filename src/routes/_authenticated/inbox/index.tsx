import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, createFileRoute } from "@tanstack/react-router";
import { Inbox, Plus, RefreshCw } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { ComposeSheet } from "@/components/ComposeSheet";
import { EmptyState, ScreenHeader } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { useBootstrap } from "@/hooks/useBootstrap";
import { errorMessage, formatPhone, initialsFor, relativeTime } from "@/lib/format";
import { importHistory } from "@/lib/twilio.functions";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/inbox/")({
  head: () => ({
    meta: [
      { title: "Inbox — Signalbox" },
      { name: "description", content: "Every SMS, MMS and WhatsApp conversation in one thread list." },
      { property: "og:title", content: "Inbox — Signalbox" },
      { property: "og:description", content: "Every SMS, MMS and WhatsApp conversation in one thread list." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: InboxScreen,
});

function InboxScreen() {
  const boot = useBootstrap();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [composing, setComposing] = useState(false);
  const [importing, setImporting] = useState(false);

  const conversations = useQuery({
    queryKey: ["conversations"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("conversations")
        .select("*")
        .eq("archived", false)
        .order("last_message_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return data;
    },
  });

  useEffect(() => {
    const channel = supabase
      .channel("inbox-conversations")
      .on("postgres_changes", { event: "*", schema: "public", table: "conversations" }, () => {
        void queryClient.invalidateQueries({ queryKey: ["conversations"] });
      })
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [queryClient]);

  async function runImport() {
    setImporting(true);
    try {
      const result = await importHistory();
      toast.success(`Pulled ${result.imported} message${result.imported === 1 ? "" : "s"} from Twilio.`);
      await queryClient.invalidateQueries({ queryKey: ["conversations"] });
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setImporting(false);
    }
  }

  const rows = (conversations.data ?? []).filter((c) => {
    const needle = search.trim().toLowerCase();
    if (!needle) return true;
    return (
      c.contact_number.toLowerCase().includes(needle) ||
      (c.contact_name ?? "").toLowerCase().includes(needle) ||
      (c.last_message_preview ?? "").toLowerCase().includes(needle)
    );
  });

  return (
    <div>
      <ScreenHeader
        title="Inbox"
        subtitle={`${boot.numbers.length} number${boot.numbers.length === 1 ? "" : "s"} · SMS, MMS & WhatsApp`}
        action={
          <Button size="icon" variant="ghost" onClick={runImport} disabled={importing}>
            <RefreshCw className={cn("h-4 w-4", importing && "animate-spin")} />
            <span className="sr-only">Import Twilio history</span>
          </Button>
        }
      />

      <div className="px-4 py-3">
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search conversations"
          className="h-11 rounded-xl"
        />
      </div>

      {conversations.isLoading ? (
        <div className="space-y-2 px-4">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="h-16 animate-pulse rounded-xl bg-secondary" />
          ))}
        </div>
      ) : rows.length === 0 ? (
        <EmptyState
          icon={Inbox}
          title="No conversations yet"
          description="Send your first message, or import recent history straight from your Twilio account."
          action={
            <Button onClick={runImport} variant="secondary" disabled={importing}>
              Import from Twilio
            </Button>
          }
        />
      ) : (
        <ul className="divide-y divide-border">
          {rows.map((c) => (
            <li key={c.id}>
              <Link
                to="/inbox/$id"
                params={{ id: c.id }}
                className="flex items-center gap-3 px-4 py-3 transition-colors active:bg-secondary"
              >
                <span
                  className={cn(
                    "flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-xs font-semibold",
                    c.channel === "whatsapp"
                      ? "bg-success/20 text-success"
                      : "bg-primary/15 text-primary",
                  )}
                >
                  {initialsFor(c.contact_name || c.contact_number)}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-baseline justify-between gap-2">
                    <span className="truncate text-sm font-semibold">
                      {c.contact_name || formatPhone(c.contact_number)}
                    </span>
                    <span className="tabular shrink-0 text-[0.7rem] text-muted-foreground">
                      {relativeTime(c.last_message_at)}
                    </span>
                  </span>
                  <span className="mt-0.5 flex items-center gap-2">
                    <span className="truncate text-xs text-muted-foreground">
                      {c.last_message_preview || "No messages yet"}
                    </span>
                    {c.unread_count > 0 ? (
                      <span className="ml-auto flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-[0.65rem] font-bold text-primary-foreground">
                        {c.unread_count}
                      </span>
                    ) : null}
                  </span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}

      <button
        type="button"
        onClick={() => setComposing(true)}
        className="fixed right-[max(1rem,calc(50%-14rem))] bottom-[calc(5.25rem+env(safe-area-inset-bottom))] z-40 flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg transition-transform active:scale-95"
      >
        <Plus className="h-6 w-6" />
        <span className="sr-only">New message</span>
      </button>

      <ComposeSheet open={composing} onOpenChange={setComposing} numbers={boot.numbers} />
    </div>
  );
}