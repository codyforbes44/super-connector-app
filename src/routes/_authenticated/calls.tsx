import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import {
  ArrowDownLeft,
  ArrowUpRight,
  Filter,
  Smartphone,
  PhoneCall,
  PhoneOff,
  PhoneOutgoing,
  Play,
  RefreshCw,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { EmptyState, ScreenHeader } from "@/components/AppShell";
import { CallFilters, type CallFilterState } from "@/components/CallFilters";
import { Dialpad } from "@/components/Dialpad";
import { Button } from "@/components/ui/button";
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
import { useVoice } from "@/lib/voice-device";

export const Route = createFileRoute("/_authenticated/calls")({
  validateSearch: (search: Record<string, unknown>): CallFilterState => {
    const pick = <T extends string>(raw: unknown, allowed: readonly T[], fallback: T): T =>
      allowed.includes(raw as T) ? (raw as T) : fallback;
    return {
      q: typeof search['q'] === "string" ? search['q'] : "",
      direction: pick(search['direction'], ["all", "inbound", "outbound"] as const, "all"),
      range: pick(search['range'], ["all", "today", "7d", "30d"] as const, "all"),
      device: pick(search['device'], ["all", "app", "phone"] as const, "all"),
    };
  },
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
  const voice = useVoice();
  const filters = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });
  const [dialing, setDialing] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [from, setFrom] = useState(boot.numbers[0]?.phone_number ?? "");
  const [to, setTo] = useState("");
  const [audio, setAudio] = useState<string | null>(null);
  const [detail, setDetail] = useState<CallRow | null>(null);

  function setFilters(patch: Partial<CallFilterState>) {
    void navigate({ search: (prev) => ({ ...prev, ...patch }), replace: true });
  }

  const calls = useQuery({
    queryKey: ["calls", filters],
    queryFn: async () => {
      let query = supabase
        .from("calls")
        .select(sel("*"))
        .order("started_at", { ascending: false })
        .limit(200);

      if (filters.direction !== "all") query = query.eq("direction", filters.direction);
      if (filters.device !== "all") query = query.eq("answered_in_app", filters.device === "app");

      const since = rangeStart(filters.range);
      if (since) query = query.gte("started_at", since);

      const term = filters.q.trim();
      if (term) {
        const like = `%${term}%`;
        query = query.or(
          [
            `from_number.ilike.${like}`,
            `to_number.ilike.${like}`,
            `app_number.ilike.${like}`,
            `status.ilike.${like}`,
            `sid.ilike.${like}`,
            `client_identity.ilike.${like}`,
            `transcription.ilike.${like}`,
          ].join(","),
        );
      }

      const { data, error } = await query.returns<CallRow[]>();
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
      if (voice.ready) {
        await voice.call(to.trim(), from);
      } else {
        await startCall({ data: { appNumber: from, to } });
        toast.success("Calling your phone now — answer to be connected.");
      }
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
        <button
          type="button"
          onClick={() => setDialing(true)}
          className="key-call flex w-full items-center justify-center gap-2 rounded-full py-4 text-sm font-semibold transition-transform active:scale-[0.98]"
        >
          <PhoneOutgoing className="h-4 w-4" />
          Open dialer
        </button>
      </div>

      {audio ? (
        <div className="glass-panel mx-4 mb-3 rounded-3xl p-3">
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
        <ul className="space-y-2 px-3 pb-4">
          {(calls.data ?? []).map((call) => {
            const inbound = call.direction === "inbound";
            const other = inbound ? call.from_number : call.to_number;
            return (
              <li key={call.id} className="glass-panel flex items-center gap-3 rounded-3xl px-3.5 py-3">
                <span
                  className={cn(
                    "flex h-10 w-10 shrink-0 items-center justify-center rounded-full",
                    call.status === "no-answer" || call.status === "failed"
                      ? "key-end"
                      : inbound
                        ? "key-call"
                        : "key-signal",
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
                <button
                  type="button"
                  onClick={() => playRecording(call.sid)}
                  className="key-raised flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-foreground"
                >
                  <Play className="h-4 w-4" />
                  <span className="sr-only">Play recording</span>
                </button>
              </li>
            );
          })}
        </ul>
      )}

      <Sheet open={dialing} onOpenChange={setDialing}>
        <SheetContent side="bottom" className="app-gradient rounded-t-[2rem] border-border">
          <SheetHeader className="px-0">
            <SheetTitle className="font-display text-center">Dialer</SheetTitle>
          </SheetHeader>
          <form onSubmit={dial} className="space-y-5 pb-[calc(env(safe-area-inset-bottom)+1rem)]">
            <Dialpad value={to} onChange={setTo} />

            <div className="space-y-1.5">
              <Label className="text-[0.7rem] tracking-wide text-muted-foreground uppercase">
                Caller ID
              </Label>
              <Select value={from} onValueChange={setFrom}>
                <SelectTrigger className="h-11 w-full rounded-full px-4">
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

            <div className="flex items-center justify-center gap-8">
              <button
                type="button"
                onClick={() => setDialing(false)}
                className="key-end flex h-16 w-16 items-center justify-center rounded-full transition-transform active:scale-95"
              >
                <PhoneOff className="h-6 w-6" />
                <span className="sr-only">Close dialer</span>
              </button>
              <button
                type="submit"
                disabled={!to.trim()}
                className="key-call flex h-16 w-16 items-center justify-center rounded-full transition-transform active:scale-95 disabled:opacity-40"
              >
                <PhoneCall className="h-6 w-6" />
                <span className="sr-only">Connect call</span>
              </button>
            </div>

            <p className="text-center text-xs text-muted-foreground">
              {voice.ready
                ? "Calls connect right here in the app using your Twilio caller ID."
                : "In-app calling is offline, so Twilio will ring your own phone first and bridge the call."}
            </p>
          </form>
        </SheetContent>
      </Sheet>
    </div>
  );
}