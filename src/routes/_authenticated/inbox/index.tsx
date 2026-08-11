import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, createFileRoute } from "@tanstack/react-router";
import { Archive, Check, Inbox, MessageSquarePlus, RefreshCw } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

import { ComposeSheet } from "@/components/ComposeSheet";
import { EmptyState, ScreenHeader, useScreenFab } from "@/components/AppShell";
import { SwipeRow } from "@/components/SwipeRow";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { useBootstrap } from "@/hooks/useBootstrap";
import { errorMessage, formatPhone, initialsFor, relativeTime } from "@/lib/format";
import { importHistory, markConversationRead } from "@/lib/twilio.functions";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/inbox/")({
  head: () => ({
    meta: [
      { title: "Inbox — SixVox" },
      { name: "description", content: "Every SMS, MMS and WhatsApp conversation in one thread list." },
      { property: "og:title", content: "Inbox — SixVox" },
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

  useScreenFab({
    icon: MessageSquarePlus,
    label: "New message",
    onClick: useCallback(() => setComposing(true), []),
  });

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

  async function markRead(id: string) {
    try {
      await markConversationRead({ data: { conversationId: id } });
      await queryClient.invalidateQueries({ queryKey: ["conversations"] });
    } catch (error) {
      toast.error(errorMessage(error));
    }
  }

  async function archive(id: string) {
    const { error } = await supabase.from("conversations").update({ archived: true }).eq("id", id);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Conversation archived.");
    await queryClient.invalidateQueries({ queryKey: ["conversations"] });
  }

  return (
    <div>
      <ScreenHeader
        title="Inbox"
        subtitle={`${boot.numbers.length} number${boot.numbers.length === 1 ? "" : "s"} · SMS, MMS & WhatsApp`}
        action={
          <Button size="icon" variant="ghost" onClick={runImport} disabled={importing}>
            <RefreshCw className={cn("h-4 w-4", importing && "animate-spin")} />
            <span className="sr-only">Import call and text history</span>
          </Button>
        }
      />

      <div className="px-4 py-3">
          <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search conversations"
            className="h-11 rounded-full px-4"
        />
      </div>

      {conversations.isLoading ? (
        <div className="space-y-2 px-4">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="h-16 animate-pulse rounded-3xl bg-secondary" />
          ))}
        </div>
      ) : rows.length === 0 ? (
        <EmptyState
          icon={Inbox}
          title="No conversations yet"
          description="Send your first message, or import recent history straight from your carrier."
          action={
            <Button onClick={runImport} variant="secondary" disabled={importing}>
              Import history
            </Button>
          }
        />
      ) : (
        <ul className="divide-y divide-border/60 border-y border-border/60 pb-4">
          {rows.map((c) => (
            <li key={c.id}>
              <SwipeRow
                left={
                  c.unread_count > 0
                    ? {
                        label: "Mark read",
                        icon: <Check className="size-4" />,
                        onAction: () => void markRead(c.id),
                      }
                    : undefined
                }
                right={{
                  label: "Archive",
                  icon: <Archive className="size-4" />,
                  tone: "muted",
                  onAction: () => void archive(c.id),
                }}
              >
                <Link
                  to="/inbox/$id"
                  params={{ id: c.id }}
                  className="flex min-h-[4.5rem] items-center gap-3 bg-background/40 px-4 py-3 transition-colors active:bg-secondary/60"
                >
                  <span
                    className={cn(
                      "flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-xs font-semibold",
                      c.channel === "whatsapp"
                        ? "bg-success/15 text-success"
                        : "bg-primary/15 text-primary",
                    )}
                  >
                    {initialsFor(c.contact_name || c.contact_number)}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-baseline justify-between gap-2">
                      <span
                        className={cn(
                          "truncate text-[0.95rem]",
                          c.unread_count > 0 ? "font-semibold" : "font-medium",
                        )}
                      >
                        {c.contact_name || formatPhone(c.contact_number)}
                      </span>
                      <span className="tabular shrink-0 text-[0.7rem] text-muted-foreground">
                        {relativeTime(c.last_message_at)}
                      </span>
                    </span>
                    <span className="mt-0.5 flex items-center gap-2">
                      <span
                        className={cn(
                          "truncate text-[0.8rem]",
                          c.unread_count > 0 ? "text-foreground/80" : "text-muted-foreground",
                        )}
                      >
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
              </SwipeRow>
            </li>
          ))}
        </ul>
      )}

      <ComposeSheet open={composing} onOpenChange={setComposing} numbers={boot.numbers} />
    </div>
  );
}