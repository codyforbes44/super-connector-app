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
import { AiCallTranscript } from "@/components/AiCallTranscript";
import { CallFilters, type CallFilterState } from "@/components/CallFilters";
import { Dialpad } from "@/components/Dialpad";
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
import { useVoice } from "@/lib/voice-device";
import type { Tables } from "@/integrations/supabase/types";

type CallRow = Tables<"calls">;

const sel = (s: string): string => s;

function rangeStart(range: CallFilterState["range"]): string | null {
  if (range === "all") return null;
  const now = new Date();
  if (range === "today") {
    now.setHours(0, 0, 0, 0);
    return now.toISOString();
  }
  const days = range === "7d" ? 7 : 30;
  return new Date(now.getTime() - days * 86_400_000).toISOString();
}

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
      { title: "Calls — SixVox" },
      { name: "description", content: "Twilio call history, click-to-call and recordings." },
      { property: "og:title", content: "Calls — SixVox" },
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
  const [from, setFrom] = useState(
    (boot.profile?.default_number as string | null) ?? boot.numbers[0]?.phone_number ?? "",
  );
  const [to, setTo] = useState("");
  const [callbackNumber, setCallbackNumber] = useState(
    (boot.profile?.agent_phone as string | null) ?? "",
  );
  const [audio, setAudio] = useState<string | null>(null);
  const [detail, setDetail] = useState<CallRow | null>(null);

  function setFilters(patch: Partial<CallFilterState>) {
    void navigate({ search: (prev: CallFilterState) => ({ ...prev, ...patch }), replace: true });
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
        await startCall({
          data: { appNumber: from, to, callbackNumber: callbackNumber.trim() || null },
        });
        await queryClient.invalidateQueries({ queryKey: ["bootstrap"] });
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

      <CallFilters value={filters} onChange={setFilters} />

      {audio ? (
        <div className="glass-panel mx-4 mb-3 rounded-3xl p-3">
          {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
          <audio className="w-full" controls autoPlay src={audio} />
        </div>
      ) : null}

      {(calls.data ?? []).length === 0 ? (
        <EmptyState
          icon={filters.q || filters.direction !== "all" || filters.range !== "all" || filters.device !== "all" ? Filter : PhoneCall}
          title={
            filters.q || filters.direction !== "all" || filters.range !== "all" || filters.device !== "all"
              ? "No matching calls"
              : "No calls yet"
          }
          description="Place a call, adjust your filters, or pull your recent Twilio voice history into the app."
          action={
            <Button variant="secondary" onClick={sync} disabled={syncing}>
              Sync my numbers
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
                <button
                  type="button"
                  onClick={() => setDetail(call)}
                  className="flex min-w-0 flex-1 items-center gap-3 text-left"
                >
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
                  <p className="flex items-center gap-1.5 truncate text-sm font-semibold">
                    {formatPhone(other)}
                    {call.answered_in_app ? (
                      <Smartphone className="h-3 w-3 shrink-0 text-primary" aria-label="Answered in app" />
                    ) : null}
                  </p>
                  <p className="tabular truncate text-[0.7rem] text-muted-foreground">
                    {call.status} · {duration(call.duration)} · via {formatPhone(call.app_number)}
                  </p>
                </div>
                <span className="tabular text-[0.7rem] text-muted-foreground">
                  {relativeTime(call.started_at)}
                </span>
                </button>
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

      <Sheet open={detail !== null} onOpenChange={(open) => !open && setDetail(null)}>
        <SheetContent side="bottom" className="app-gradient rounded-t-[2rem] border-border">
          <SheetHeader className="px-0">
            <SheetTitle className="font-display text-center">Call details</SheetTitle>
          </SheetHeader>
          {detail ? (
            <dl className="space-y-1.5 pb-[calc(env(safe-area-inset-bottom)+1rem)] text-sm">
              {[
                ["From", formatPhone(detail.from_number)],
                ["To", formatPhone(detail.to_number)],
                ["Twilio number", formatPhone(detail.app_number)],
                ["Direction", detail.direction],
                ["Status", detail.status ?? "—"],
                ["Duration", duration(detail.duration)],
                ["Device", detail.answered_in_app ? "In-app (TwiML App client)" : "Phone / forwarded"],
                ["Client identity", detail.client_identity ?? "—"],
                ["Price", detail.price ?? "—"],
                ["Started", new Date(detail.started_at).toLocaleString()],
                ["Call SID", detail.sid],
                ...(detail.transcription ? [["Transcription", detail.transcription]] : []),
              ].map(([label, value]) => (
                <div
                  key={label as string}
                  className="glass-panel flex items-start justify-between gap-3 rounded-2xl px-3.5 py-2.5"
                >
                  <dt className="shrink-0 text-[0.7rem] tracking-wide text-muted-foreground uppercase">
                    {label}
                  </dt>
                  <dd className="tabular min-w-0 text-right break-words">{value}</dd>
                </div>
              ))}
            </dl>
          ) : null}
          {detail ? <AiCallTranscript callSid={detail.sid} /> : null}
        </SheetContent>
      </Sheet>

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
              {(() => {
                const selected = boot.numbers.find((n) => n.phone_number === from);
                const presented = selected?.outbound_caller_id as string | null | undefined;
                return presented ? (
                  <p className="text-[0.7rem] text-muted-foreground">
                    Recipients see your verified caller ID {formatPhone(presented)}.
                  </p>
                ) : null;
              })()}
            </div>

            {!voice.ready ? (
              <div className="space-y-1.5">
                <Label
                  htmlFor="callback-number"
                  className="text-[0.7rem] tracking-wide text-muted-foreground uppercase"
                >
                  Call me on
                </Label>
                <Input
                  id="callback-number"
                  inputMode="tel"
                  maxLength={20}
                  placeholder="+1 555 010 2030"
                  value={callbackNumber}
                  onChange={(event: React.ChangeEvent<HTMLInputElement>) =>
                    setCallbackNumber(event.target.value)
                  }
                  className="h-11 rounded-full px-4"
                />
                <p className="text-[0.7rem] text-muted-foreground">
                  We ring this phone first, then bridge the contact. Saved for next time.
                </p>
              </div>
            ) : null}

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
                disabled={!to.trim() || (!voice.ready && callbackNumber.trim().length < 7)}
                className="key-call flex h-16 w-16 items-center justify-center rounded-full transition-transform active:scale-95 disabled:opacity-40"
              >
                <PhoneCall className="h-6 w-6" />
                <span className="sr-only">Connect call</span>
              </button>
            </div>

            <p className="text-center text-xs text-muted-foreground">
              {voice.ready
                ? "In-app call — connects right here using your caller ID."
                : `We'll ring ${callbackNumber.trim() ? formatPhone(callbackNumber.trim()) : "your phone"} first, then connect the contact.`}
            </p>
          </form>
        </SheetContent>
      </Sheet>
    </div>
  );
}