import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import {
  ArrowDownLeft,
  ArrowUpRight,
  PhoneCall,
  PhoneOutgoing,
  Play,
  RefreshCw,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { EmptyState, ScreenHeader } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { supabase } from "@/integrations/supabase/client";
import { useBootstrap } from "@/hooks/useBootstrap";
import { duration, errorMessage, formatPhone, relativeTime } from "@/lib/format";
import {
  getCallRecordings,
  getRecordingAudio,
  importCallHistory,
  startCall,
} from "@/lib/twilio.functions";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/calls")({
  head: () => ({
    meta: [
      { title: "Calls — Signalbox" },
      { name: "description", content: "Twilio call history, click-to-call and recordings." },
      { property: "og:title", content: "Calls — Signalbox" },
      { property: "og:description", content: "Twilio call history, click-to-call and recordings." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: CallsScreen,
});

function CallsScreen() {
  const boot = useBootstrap();
  const queryClient = useQueryClient();
  const [dialing, setDialing] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [from, setFrom] = useState(boot.numbers[0]?.phone_number ?? "");
  const [to, setTo] = useState("");
  const [audio, setAudio] = useState<string | null>(null);

  const calls = useQuery({
    queryKey: ["calls"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("calls")
        .select("*")
        .order("started_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return data;
    },
  });

  async function sync() {
    setSyncing(true);
    try {
      const result = await importCallHistory();
      toast.success(`Synced ${result.imported} call${result.imported === 1 ? "" : "s"}.`);
      await queryClient.invalidateQueries({ queryKey: ["calls"] });
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setSyncing(false);
    }
  }

  async function dial(event: React.FormEvent) {
    event.preventDefault();
    try {
      await startCall({ data: { appNumber: from, to } });
      toast.success("Calling your phone now — answer to be connected.");
      setDialing(false);
      setTo("");
    } catch (error) {
      toast.error(errorMessage(error));
    }
  }

  async function playRecording(sid: string) {
    try {
      const recordings = await getCallRecordings({ data: { sid } });
      if (!recordings.length) {
        toast.info("No recording was captured for this call.");
        return;
      }
      const first = recordings[0]!;
      const result = await getRecordingAudio({ data: { sid: first.sid } });
      setAudio(result.dataUrl);
    } catch (error) {
      toast.error(errorMessage(error));
    }
  }

  return (
    <div>
      <ScreenHeader
        title="Calls"
        subtitle="Click-to-call, history, recordings"
        action={
          <Button size="icon" variant="ghost" onClick={sync} disabled={syncing}>
            <RefreshCw className={cn("h-4 w-4", syncing && "animate-spin")} />
            <span className="sr-only">Sync call history</span>
          </Button>
        }
      />

      <div className="px-4 py-3">
        <Button className="h-12 w-full font-semibold" onClick={() => setDialing(true)}>
          <PhoneOutgoing className="mr-2 h-4 w-4" />
          New call
        </Button>
      </div>

      {audio ? (
        <div className="px-4 pb-3">
          {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
          <audio className="w-full" controls autoPlay src={audio} />
        </div>
      ) : null}

      {(calls.data ?? []).length === 0 ? (
        <EmptyState
          icon={PhoneCall}
          title="No calls yet"
          description="Place a call, or pull your recent Twilio voice history into the app."
          action={
            <Button variant="secondary" onClick={sync} disabled={syncing}>
              Sync from Twilio
            </Button>
          }
        />
      ) : (
        <ul className="divide-y divide-border">
          {(calls.data ?? []).map((call) => {
            const inbound = call.direction === "inbound";
            const other = inbound ? call.from_number : call.to_number;
            return (
              <li key={call.id} className="flex items-center gap-3 px-4 py-3">
                <span
                  className={cn(
                    "flex h-9 w-9 shrink-0 items-center justify-center rounded-full",
                    call.status === "no-answer" || call.status === "failed"
                      ? "bg-destructive/15 text-destructive"
                      : "bg-secondary text-muted-foreground",
                  )}
                >
                  {inbound ? (
                    <ArrowDownLeft className="h-4 w-4" />
                  ) : (
                    <ArrowUpRight className="h-4 w-4" />
                  )}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">{formatPhone(other)}</p>
                  <p className="tabular truncate text-[0.7rem] text-muted-foreground">
                    {call.status} · {duration(call.duration)} · via {formatPhone(call.app_number)}
                  </p>
                </div>
                <span className="tabular text-[0.7rem] text-muted-foreground">
                  {relativeTime(call.started_at)}
                </span>
                <Button size="icon" variant="ghost" onClick={() => playRecording(call.sid)}>
                  <Play className="h-4 w-4" />
                  <span className="sr-only">Play recording</span>
                </Button>
              </li>
            );
          })}
        </ul>
      )}

      <Sheet open={dialing} onOpenChange={setDialing}>
        <SheetContent side="bottom" className="rounded-t-3xl">
          <SheetHeader className="px-0">
            <SheetTitle className="font-display">New call</SheetTitle>
          </SheetHeader>
          <form onSubmit={dial} className="space-y-4 pb-[env(safe-area-inset-bottom)]">
            <p className="text-xs text-muted-foreground">
              Twilio rings your own phone first, then bridges the contact with your Twilio caller
              ID.
            </p>
            <div className="space-y-1.5">
              <Label>Caller ID</Label>
              <Select value={from} onValueChange={setFrom}>
                <SelectTrigger className="h-11 w-full">
                  <SelectValue placeholder="Number" />
                </SelectTrigger>
                <SelectContent>
                  {boot.numbers.map((n) => (
                    <SelectItem key={n.sid} value={n.phone_number}>
                      {n.friendly_name || formatPhone(n.phone_number)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="call-to">Call</Label>
              <Input
                id="call-to"
                value={to}
                onChange={(e) => setTo(e.target.value)}
                inputMode="tel"
                required
                maxLength={20}
                placeholder="+1 555 010 2030"
                className="h-11"
              />
            </div>
            <Button type="submit" className="h-12 w-full font-semibold">
              Connect call
            </Button>
          </form>
        </SheetContent>
      </Sheet>
    </div>
  );
}