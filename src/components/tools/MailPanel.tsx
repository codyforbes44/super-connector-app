import { useMutation, useQuery } from "@tanstack/react-query";
import { Loader2, Mail, Send } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { GmailConnect } from "@/components/tools/GmailConnect";
import { errorMessage, relativeTime } from "@/lib/format";
import {
  getMailUnread,
  readMailThread,
  replyMailThread,
  searchMail,
  sendMailMessage,
} from "@/lib/integrations.functions";

export function MailPanel({ presetEmail }: { presetEmail?: string }) {
  const [query, setQuery] = useState(presetEmail ?? "");
  const [active, setActive] = useState<string | null>(null);
  const [compose, setCompose] = useState({ to: presetEmail ?? "", subject: "", body: "" });
  const [replyBody, setReplyBody] = useState("");

  const mail = useQuery({
    queryKey: ["gmail", query],
    queryFn: () => searchMail({ data: { query, max: 12 } }),
  });

  const thread = useQuery({
    queryKey: ["gmail-thread", active],
    queryFn: () => readMailThread({ data: { threadId: active as string } }),
    enabled: Boolean(active),
  });

  const unread = useQuery({ queryKey: ["gmail-unread"], queryFn: () => getMailUnread() });

  const reply = useMutation({
    mutationFn: () => replyMailThread({ data: { threadId: active as string, body: replyBody } }),
    onSuccess: () => {
      toast.success("Reply sent");
      setReplyBody("");
      void thread.refetch();
      void mail.refetch();
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  const send = useMutation({
    mutationFn: () => sendMailMessage({ data: compose }),
    onSuccess: () => {
      toast.success("Email sent from Gmail");
      setCompose((c) => ({ ...c, subject: "", body: "" }));
      void mail.refetch();
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  if (mail.data && !mail.data.connected) {
    return <GmailConnect />;
  }

  return (
    <div className="space-y-4">
      <GmailConnect compact />
      {unread.data?.connected && unread.data.unread > 0 ? (
        <button
          type="button"
          onClick={() => setQuery("is:unread")}
          className="glass-panel flex w-full items-center justify-between rounded-2xl px-4 py-2.5 text-left text-sm"
        >
          <span className="font-medium">{unread.data.unread} unread in your inbox</span>
          <span className="text-xs text-primary">Show</span>
        </button>
      ) : null}
      <div className="flex gap-2">
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search mail (from:, subject:, is:unread)"
        />
        <Button variant="secondary" onClick={() => void mail.refetch()}>
          {mail.isFetching ? <Loader2 className="size-4 animate-spin" /> : "Search"}
        </Button>
      </div>

      <div className="space-y-2">
        {(mail.data?.messages ?? []).map((m) => (
          <button
            key={m.id}
            type="button"
            onClick={() => setActive(active === m.threadId ? null : m.threadId)}
            className="glass-panel w-full rounded-2xl p-3 text-left"
          >
            <div className="flex items-center justify-between gap-2">
              <span className="truncate text-sm font-medium">{m.from}</span>
              <span className="shrink-0 text-[11px] text-muted-foreground">
                {m.date ? relativeTime(m.date) : ""}
              </span>
            </div>
            <p className="truncate text-sm">{m.subject}</p>
            <p className="truncate text-xs text-muted-foreground">{m.snippet}</p>
          </button>
        ))}
        {mail.data && mail.data.messages.length === 0 && (
          <p className="px-1 text-sm text-muted-foreground">No messages found.</p>
        )}
      </div>

      {active && (
        <div className="glass-panel space-y-3 rounded-2xl p-4">
          {thread.isLoading && <Loader2 className="size-4 animate-spin" />}
          {(thread.data?.messages ?? []).map((m) => (
            <div key={m.id} className="space-y-1 border-b border-border pb-3 last:border-0">
              <p className="text-xs text-muted-foreground">
                {m.from} · {m.date ? relativeTime(m.date) : ""}
              </p>
              <p className="text-sm font-medium">{m.subject}</p>
              <p className="whitespace-pre-wrap text-sm text-muted-foreground">
                {m.body?.slice(0, 1500) || m.snippet}
              </p>
            </div>
          ))}
          <div className="space-y-2 pt-1">
            <Label>Reply</Label>
            <Textarea
              rows={3}
              value={replyBody}
              onChange={(e) => setReplyBody(e.target.value)}
              placeholder="Write a reply…"
            />
            <Button
              className="w-full"
              disabled={!replyBody.trim() || reply.isPending}
              onClick={() => reply.mutate()}
            >
              {reply.isPending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <>
                  <Send className="size-4" /> Send reply
                </>
              )}
            </Button>
          </div>
        </div>
      )}

      <div className="glass-panel space-y-3 rounded-2xl p-4">
        <p className="flex items-center gap-2 text-sm font-medium">
          <Mail className="size-4" /> Compose
        </p>
        <div className="space-y-1">
          <Label>To</Label>
          <Input
            value={compose.to}
            onChange={(e) => setCompose({ ...compose, to: e.target.value })}
            placeholder="name@example.com"
          />
        </div>
        <div className="space-y-1">
          <Label>Subject</Label>
          <Input
            value={compose.subject}
            onChange={(e) => setCompose({ ...compose, subject: e.target.value })}
          />
        </div>
        <div className="space-y-1">
          <Label>Message</Label>
          <Textarea
            rows={4}
            value={compose.body}
            onChange={(e) => setCompose({ ...compose, body: e.target.value })}
          />
        </div>
        <Button
          className="w-full"
          disabled={!compose.to || !compose.body || send.isPending}
          onClick={() => send.mutate()}
        >
          {send.isPending ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <>
              <Send className="size-4" /> Send via Gmail
            </>
          )}
        </Button>
      </div>
    </div>
  );
}