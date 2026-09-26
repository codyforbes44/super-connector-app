import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, createFileRoute, useNavigate } from "@tanstack/react-router";
import {
  AlertTriangle,
  ArrowDownLeft,
  ArrowLeft,
  ArrowUpRight,
  Phone,
  PhoneMissed,
  Send,
  Sparkles,
  StickyNote,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { clockTime, duration as formatDuration, errorMessage, formatPhone } from "@/lib/format";
import { describeMessageError } from "@/lib/message-status";
import {
  addInternalNote,
  markConversationRead,
  sendMessage,
  textingReadiness,
  startCall,
} from "@/lib/twilio.functions";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/inbox/$id")({
  head: () => ({
    meta: [
      { title: "Conversation — SixVox" },
      { name: "description", content: "Read and reply to a Twilio conversation thread." },
      { property: "og:title", content: "Conversation — SixVox" },
      { property: "og:description", content: "Read and reply to a Twilio conversation thread." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ThreadScreen,
});

function ThreadScreen() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState("");
  const [noteMode, setNoteMode] = useState(false);
  const [busy, setBusy] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  const conversation = useQuery({
    queryKey: ["conversation", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("conversations")
        .select("*")
        .eq("id", id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const messages = useQuery({
    queryKey: ["messages", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("messages")
        .select("*")
        .eq("conversation_id", id)
        .order("created_at");
      if (error) throw error;
      return data;
    },
  });

  useEffect(() => {
    const channel = supabase
      .channel(`thread-${id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "messages", filter: `conversation_id=eq.${id}` },
        () => {
          void queryClient.invalidateQueries({ queryKey: ["messages", id] });
        },
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [id, queryClient]);

  useEffect(() => {
    void markConversationRead({ data: { conversationId: id } }).then(() =>
      queryClient.invalidateQueries({ queryKey: ["conversations"] }),
    );
  }, [id, queryClient]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: "end" });
  }, [messages.data]);

  const convo = conversation.data;

  // Warn before typing when the sending number can't legally text in the US.
  const readiness = useQuery({
    queryKey: ["texting-readiness"],
    queryFn: () => textingReadiness(),
    retry: false,
  });
  const senderState =
    (
      (readiness.data ?? []) as unknown as Array<{
        phoneNumber: string;
        campaignStatus: string | null;
        ready: boolean;
      }>
    ).find((s) => s.phoneNumber === convo?.app_number) ?? null;
  const smsBlocked = convo?.channel !== "whatsapp" && Boolean(senderState) && !senderState?.ready;

  // Calls with the same contact are folded into the thread so the history of a
  // relationship reads as one timeline instead of two disconnected screens.
  const calls = useQuery({
    queryKey: ["thread-calls", convo?.contact_number],
    enabled: Boolean(convo?.contact_number),
    queryFn: async () => {
      const contact = convo!.contact_number;
      const { data, error } = await supabase
        .from("calls")
        .select("id,sid,direction,status,duration,started_at,answered_by")
        .or(`from_number.eq.${contact},to_number.eq.${contact}`)
        .order("started_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data;
    },
  });

  const callSids = (calls.data ?? []).map((c) => c.sid);
  const intel = useQuery({
    queryKey: ["thread-call-intel", callSids],
    enabled: callSids.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("call_intelligence")
        .select("call_sid,summary")
        .in("call_sid", callSids);
      if (error) throw error;
      return data;
    },
  });
  const summaryFor = new Map((intel.data ?? []).map((r) => [r.call_sid, r.summary]));

  type Item =
    | { kind: "message"; at: string; row: (typeof messagesRows)[number] }
    | { kind: "call"; at: string; row: NonNullable<typeof calls.data>[number] };
  const messagesRows = messages.data ?? [];
  const timeline: Item[] = [
    ...messagesRows.map((row) => ({ kind: "message" as const, at: row.created_at, row })),
    ...(calls.data ?? []).map((row) => ({ kind: "call" as const, at: row.started_at, row })),
  ].sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime());

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!convo || !draft.trim()) return;
    setBusy(true);
    const text = draft;
    setDraft("");
    try {
      if (noteMode) {
        await addInternalNote({ data: { conversationId: id, body: text } });
      } else {
        await sendMessage({
          data: {
            appNumber: convo.app_number,
            to: convo.contact_number,
            body: text,
            channel: convo.channel === "whatsapp" ? "whatsapp" : "sms",
          },
        });
      }
      await queryClient.invalidateQueries({ queryKey: ["messages", id] });
    } catch (error) {
      setDraft(text);
      toast.error(errorMessage(error));
    } finally {
      setBusy(false);
    }
  }

  async function call() {
    if (!convo) return;
    try {
      await startCall({ data: { appNumber: convo.app_number, to: convo.contact_number } });
      toast.success("Calling your phone now — answer to be connected.");
    } catch (error) {
      toast.error(errorMessage(error));
    }
  }

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="sticky top-0 z-30 flex items-center gap-2 border-b border-border bg-background/55 px-2 pt-[calc(env(safe-area-inset-top)+0.5rem)] pb-2 backdrop-blur-xl">
        {/* On phones this is the way back to the list; on wider screens the
            list is already beside us. */}
        <Button
          size="icon"
          variant="ghost"
          className="md:hidden"
          onClick={() => void navigate({ to: "/inbox" })}
        >
          <ArrowLeft className="h-5 w-5" />
          <span className="sr-only">Back to inbox</span>
        </Button>
        <span
          className={cn(
            "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-xs font-semibold",
            convo?.channel === "whatsapp"
              ? "ring-glow-success bg-success/20 text-success"
              : "ring-glow bg-primary/20 text-primary",
          )}
        >
          {(convo?.contact_name || convo?.contact_number || "?").slice(0, 2).toUpperCase()}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold">
            {convo?.contact_name || formatPhone(convo?.contact_number)}
          </p>
          <p className="truncate text-[0.7rem] text-muted-foreground">
            {convo?.channel === "whatsapp" ? "WhatsApp" : "SMS"} via{" "}
            {formatPhone(convo?.app_number)}
          </p>
        </div>
        <button
          type="button"
          onClick={call}
          className="key-call flex h-11 w-11 shrink-0 items-center justify-center rounded-xl transition-transform active:scale-95"
        >
          <Phone className="h-5 w-5" />
          <span className="sr-only">Call contact</span>
        </button>
      </header>

      <div className="flex-1 space-y-2 px-3 py-4">
        {timeline.map((item) => {
          if (item.kind === "call") {
            const c = item.row;
            const missed = ["no-answer", "failed", "busy", "canceled"].includes(c.status ?? "");
            const byAi = /ai|receptionist|assistant|agent/i.test(c.answered_by ?? "");
            const inbound = c.direction === "inbound";
            const CallIcon = missed ? PhoneMissed : inbound ? ArrowDownLeft : ArrowUpRight;
            const summary = summaryFor.get(c.sid);
            return (
              <div key={c.id} className="flex justify-center">
                <div className="glass-panel w-full max-w-[92%] rounded-3xl px-4 py-3">
                  <div className="flex items-center gap-2.5">
                    <span
                      className={cn(
                        "flex size-8 shrink-0 items-center justify-center rounded-full",
                        missed
                          ? "bg-destructive/15 text-destructive"
                          : inbound
                            ? "bg-success/15 text-success"
                            : "bg-primary/15 text-primary",
                      )}
                    >
                      <CallIcon className="size-4" />
                    </span>
                    <p className="min-w-0 flex-1 truncate text-sm font-medium">
                      {missed
                        ? "Missed call"
                        : byAi
                          ? "Answered by receptionist"
                          : inbound
                            ? "Incoming call"
                            : "Outgoing call"}
                      {c.duration ? (
                        <span className="tabular text-muted-foreground">
                          {" "}
                          · {formatDuration(c.duration)}
                        </span>
                      ) : null}
                    </p>
                    <span className="tabular shrink-0 text-[0.65rem] text-muted-foreground">
                      {clockTime(c.started_at)}
                    </span>
                  </div>
                  {summary ? (
                    <p className="mt-2 flex gap-1.5 text-xs text-muted-foreground">
                      <Sparkles className="mt-0.5 size-3 shrink-0 text-primary" />
                      <span>{summary}</span>
                    </p>
                  ) : null}
                </div>
              </div>
            );
          }
          const m = item.row;
          const mine = m.direction !== "inbound";
          const media = Array.isArray(m.media) ? (m.media as Array<{ url: string }>) : [];
          return (
            <div key={m.id} className={cn("flex", mine ? "justify-end" : "justify-start")}>
              <div
                className={cn(
                  "max-w-[80%] rounded-3xl px-4 py-2.5 text-sm shadow-[var(--shadow-key)]",
                  m.is_internal_note
                    ? "border border-dashed border-primary/50 bg-primary/10 text-foreground"
                    : mine
                      ? "key-signal rounded-br-lg"
                      : "glass-panel rounded-bl-lg text-foreground",
                )}
              >
                {m.is_internal_note ? (
                  <p className="mb-1 flex items-center gap-1 text-[0.65rem] font-semibold tracking-wide text-primary uppercase">
                    <StickyNote className="h-3 w-3" /> Internal note
                  </p>
                ) : null}
                {m.body ? <p className="whitespace-pre-wrap">{m.body}</p> : null}
                {media.length ? (
                  <p className="mt-1 text-[0.7rem] opacity-80">
                    {media.length} attachment{media.length === 1 ? "" : "s"}
                  </p>
                ) : null}
                <p className="tabular mt-1 text-[0.65rem] opacity-70">
                  {clockTime(m.created_at)}
                  {m.status && mine && !m.is_internal_note ? ` · ${m.status}` : ""}
                </p>
                {mine && !m.is_internal_note && describeMessageError(m.error_code) ? (
                  <p className="mt-1 flex items-start gap-1 rounded-xl bg-destructive/15 px-2 py-1 text-[0.65rem] text-destructive">
                    <AlertTriangle className="mt-0.5 size-3 shrink-0" />
                    <span>{describeMessageError(m.error_code)}</span>
                  </p>
                ) : null}
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      {convo?.opted_out ? (
        <div className="sticky bottom-[calc(4.5rem+env(safe-area-inset-bottom))] border-t border-border bg-background/80 px-4 py-3 text-center text-xs text-muted-foreground backdrop-blur-xl">
          <AlertTriangle className="mr-1 inline size-3.5 text-destructive" />
          This contact replied STOP. Texting is blocked until they reply START.
        </div>
      ) : smsBlocked ? (
        <div className="sticky bottom-[calc(4.5rem+env(safe-area-inset-bottom))] border-t border-border bg-background/80 px-4 py-3 text-center text-xs text-muted-foreground backdrop-blur-xl">
          <AlertTriangle className="mr-1 inline size-3.5 text-destructive" />
          {formatPhone(convo?.app_number ?? "")} isn&apos;t approved for US texting yet.{" "}
          <Link to="/a2p" className="font-medium text-primary underline underline-offset-2">
            Finish US texting approval
          </Link>{" "}
          to reply from this number.
        </div>
      ) : (
        <form
          onSubmit={submit}
          className="sticky bottom-[calc(4.5rem+env(safe-area-inset-bottom))] border-t border-border bg-background/60 px-3 py-2 backdrop-blur-xl"
        >
          <div className="glass-panel flex items-end gap-2 rounded-full p-1.5">
            <button
              type="button"
              onClick={() => setNoteMode(!noteMode)}
              className={cn(
                "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition-transform active:scale-95",
                noteMode ? "key-signal" : "key-raised text-muted-foreground",
              )}
            >
              <StickyNote className="h-4 w-4" />
              <span className="sr-only">Toggle internal note</span>
            </button>
            <Textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              rows={1}
              maxLength={1500}
              placeholder={noteMode ? "Internal note (not sent)" : "Message"}
              className="max-h-32 min-h-10 resize-none rounded-2xl border-0 bg-transparent px-2 py-2.5 shadow-none focus-visible:ring-0"
            />
            <button
              type="submit"
              disabled={busy || !draft.trim()}
              className="key-call flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition-transform active:scale-95 disabled:opacity-50"
            >
              <Send className="h-4 w-4" />
              <span className="sr-only">Send</span>
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
