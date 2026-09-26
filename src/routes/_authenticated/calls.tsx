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
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

import { ScreenHeader, useScreenFab } from "@/components/AppShell";
import { AsyncList, Empty, ListGroup, Screen } from "@/components/screen";
import { AiCallTranscript } from "@/components/AiCallTranscript";
import { CallSummaryCard } from "@/components/intelligence/CallSummaryCard";
import { CallerContextCard } from "@/components/intelligence/CallerContextCard";
import { CallFilters, type CallFilterState } from "@/components/CallFilters";
import { CallReadiness } from "@/components/CallReadiness";
import { Dialpad } from "@/components/Dialpad";
import { markAnswerIntent } from "@/lib/call-answer-intent";
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
import type { Tables } from "@/integrations/supabase/types";

type CallRow = Tables<"calls">;

type CallSearch = CallFilterState & { incoming?: string; answer?: string };

/** The other party on a call row, or "" when the number is unusable. */
function otherParty(call: CallRow): string {
  const raw = call.direction === "inbound" ? call.from_number : call.to_number;
  const value = (raw ?? "").trim();
  if (!value || /anonymous|unknown|restricted|private/i.test(value)) return "";
  return value.replace(/^client:/, "");
}

const sel = (s: string): string => s;

/** Plain-language description of what happened on a call. */
function callStory(call: CallRow): string {
  const inbound = call.direction === "inbound";
  const failed = ["no-answer", "failed", "busy", "canceled"].includes(call.status ?? "");
  const byAi = /ai|receptionist|assistant|agent/i.test(call.answered_by ?? "");
  if (failed) return inbound ? "Missed call" : "No answer";
  if (byAi) return "Answered by receptionist";
  return inbound ? "Incoming call" : "Outgoing call";
}

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
  validateSearch: (search: Record<string, unknown>): CallSearch => {
    const pick = <T extends string>(raw: unknown, allowed: readonly T[], fallback: T): T =>
      allowed.includes(raw as T) ? (raw as T) : fallback;
    return {
      q: typeof search["q"] === "string" ? search["q"] : "",
      direction: pick(search["direction"], ["all", "inbound", "outbound"] as const, "all"),
      range: pick(search["range"], ["all", "today", "7d", "30d"] as const, "all"),
      device: pick(search["device"], ["all", "app", "phone"] as const, "all"),
      ...(typeof search["incoming"] === "string" && search["incoming"]
        ? { incoming: search["incoming"] }
        : {}),
      ...(search["answer"] === "1" || search["answer"] === true ? { answer: "1" } : {}),
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
  const search = Route.useSearch();
  const filters = search;
  const navigate = useNavigate({ from: Route.fullPath });
  const [dialing, setDialing] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [from, setFrom] = useState(
    (boot.profile?.default_number as string | null) ?? boot.numbers[0]?.phone_number ?? "",
  );
  const [to, setTo] = useState("");
  const savedCallback = (boot.profile?.agent_phone as string | null) ?? "";
  const selectedNumber = boot.numbers.find((n) => n.phone_number === from);
  const presentedCallerId =
    (selectedNumber?.outbound_caller_id as string | null | undefined) || from;
  const [audio, setAudio] = useState<string | null>(null);
  const [detail, setDetail] = useState<CallRow | null>(null);

  useScreenFab({
    icon: PhoneOutgoing,
    label: "Open dialer",
    onClick: useCallback(() => setDialing(true), []),
  });

  function setFilters(patch: Partial<CallFilterState>) {
    void navigate({ search: (prev: CallSearch) => ({ ...prev, ...patch }), replace: true });
  }

  // Opened from an "Incoming call" notification: make sure the mic is ready so
  // the in-call screen can answer as soon as the device receives the call.
  const incoming = search.incoming;
  const answerIntent = search.answer === "1";
  const [ringHint, setRingHint] = useState(false);
  useEffect(() => {
    if (!incoming && !answerIntent) return;
    setRingHint(true);
    // Came from the notification's "Answer" action: pick up automatically the
    // moment Twilio rings this device.
    if (answerIntent) markAnswerIntent();
    void voice.requestMic();
    void navigate({
      search: (prev: CallSearch) => {
        const { incoming: _drop, answer: _dropAnswer, ...rest } = prev;
        return rest;
      },
      replace: true,
    });
    const id = setTimeout(() => setRingHint(false), 25_000);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [incoming, answerIntent]);

  useEffect(() => {
    if (voice.callState !== "idle") setRingHint(false);
  }, [voice.callState]);

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
        const result = await startCall({ data: { appNumber: from, to } });
        await queryClient.invalidateQueries({ queryKey: ["bootstrap"] });
        toast.success(
          result.mode === "bridge"
            ? "Calling your phone now — answer to be connected."
            : `Dialing ${formatPhone(to.trim())} from ${formatPhone(result.callerId)}…`,
        );
      }
      setDialing(false);
      setTo("");
    } catch (error) {
      toast.error(errorMessage(error));
    }
  }

  async function playVoicemail(sid: string) {
    try {
      const recordings = await getCallRecordings({ data: { sid } });
      if (!recordings.length) {
        toast.info("No voicemail was left on this call.");
        return;
      }
      const first = recordings[0]!;
      const result = await getRecordingAudio({ data: { sid: first.sid } });
      setAudio(result.dataUrl);
    } catch (error) {
      toast.error(errorMessage(error));
    }
  }

  /** Redial a party from the number the original call used. */
  async function callBack(call: CallRow) {
    const target = otherParty(call);
    if (!target) return;
    const line =
      boot.numbers.find((n) => n.phone_number === call.app_number)?.phone_number ||
      from ||
      boot.numbers[0]?.phone_number ||
      "";
    if (!line) {
      toast.error("No number available to call from yet.");
      return;
    }
    try {
      if (voice.ready) {
        await voice.call(target, line);
      } else {
        const result = await startCall({ data: { appNumber: line, to: target } });
        toast.success(
          result.mode === "bridge"
            ? "Calling your phone now — answer to be connected."
            : `Dialing ${formatPhone(target)} from ${formatPhone(result.callerId)}…`,
        );
      }
      setDetail(null);
    } catch (error) {
      toast.error(errorMessage(error));
    }
  }

  return (
    <div className="min-w-0 overflow-x-clip">
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

      <CallFilters value={filters} onChange={setFilters} />

      <Screen onRefresh={sync}>
        <CallReadiness />

        {ringHint && voice.callState === "idle" ? (
          <p className="mb-3 rounded-2xl border border-border bg-card px-3.5 py-2.5 text-xs text-muted-foreground">
            Connecting the incoming call to this device…
          </p>
        ) : null}

        {audio ? (
          <div className="mb-3 rounded-2xl border border-border bg-card p-3">
            {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
            <audio className="w-full" controls autoPlay src={audio} />
          </div>
        ) : null}

        <AsyncList
          query={calls}
          items={calls.data ?? []}
          skeletonRows={6}
          errorTitle="Couldn't load your calls"
          empty={
            <Empty
              icon={
                filters.q ||
                filters.direction !== "all" ||
                filters.range !== "all" ||
                filters.device !== "all"
                  ? Filter
                  : PhoneCall
              }
              title={
                filters.q ||
                filters.direction !== "all" ||
                filters.range !== "all" ||
                filters.device !== "all"
                  ? "No matching calls"
                  : "No calls yet"
              }
              description="Place a call, adjust your filters, or pull your recent call history into the app."
              action={
                <Button variant="secondary" onClick={sync} disabled={syncing}>
                  Sync call history
                </Button>
              }
            />
          }
        >
          {(pageCalls) => (
            <ListGroup className="min-w-0">
              {pageCalls.map((call) => {
                const inbound = call.direction === "inbound";
                const other = inbound ? call.from_number : call.to_number;
                const redialTo = otherParty(call);
                const missed = ["no-answer", "failed", "busy", "canceled"].includes(
                  call.status ?? "",
                );
                return (
                  <div
                    key={call.id}
                    className="flex min-h-[4.5rem] min-w-0 items-center gap-2.5 px-4 py-3 sm:gap-3"
                  >
                    <button
                      type="button"
                      onClick={() => setDetail(call)}
                      className="flex min-w-0 flex-1 items-center gap-2.5 text-left sm:gap-3"
                    >
                      <span
                        className={cn(
                          "flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl",
                          missed
                            ? "bg-destructive/15 text-destructive"
                            : inbound
                              ? "bg-success/15 text-success"
                              : "bg-primary/15 text-primary",
                        )}
                      >
                        {inbound ? (
                          <ArrowDownLeft className="h-4 w-4" />
                        ) : (
                          <ArrowUpRight className="h-4 w-4" />
                        )}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="flex min-w-0 items-center gap-1.5 text-[0.95rem] font-medium">
                          <span className="truncate">{formatPhone(other)}</span>
                          {call.answered_in_app ? (
                            <Smartphone
                              className="h-3 w-3 shrink-0 text-primary"
                              aria-label="Answered in app"
                            />
                          ) : null}
                          <span className="tabular ml-auto shrink-0 pl-1 text-[0.7rem] font-normal text-muted-foreground">
                            {relativeTime(call.started_at)}
                          </span>
                        </p>
                        <p className="flex min-w-0 items-center gap-1.5 truncate text-[0.78rem] text-muted-foreground">
                          {missed ? (
                            <span className="shrink-0 rounded-full bg-destructive/15 px-2 py-0.5 text-[0.65rem] font-semibold text-destructive">
                              Missed
                            </span>
                          ) : call.recording_url ? (
                            <span className="shrink-0 rounded-full bg-primary/15 px-2 py-0.5 text-[0.65rem] font-semibold text-primary">
                              Voicemail
                            </span>
                          ) : null}
                          <span className={cn("truncate", missed && "text-destructive")}>
                            {callStory(call)}
                          </span>
                          {call.duration ? (
                            <span className="tabular"> · {duration(call.duration)}</span>
                          ) : null}
                        </p>
                      </div>
                    </button>
                    <button
                      type="button"
                      onClick={() => playVoicemail(call.sid)}
                      className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-secondary/70 text-foreground"
                    >
                      <Play className="h-4 w-4" />
                      <span className="sr-only">Play voicemail</span>
                    </button>
                    <button
                      type="button"
                      disabled={!redialTo}
                      onClick={() => void callBack(call)}
                      className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-success/15 text-success disabled:opacity-40"
                    >
                      <PhoneCall className="h-4 w-4" />
                      <span className="sr-only">Call back {redialTo || "unavailable"}</span>
                    </button>
                  </div>
                );
              })}
            </ListGroup>
          )}
        </AsyncList>
      </Screen>

      <Sheet open={detail !== null} onOpenChange={(open) => !open && setDetail(null)}>
        <SheetContent side="bottom" className="rounded-t-3xl border-border bg-card">
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
                [
                  "Device",
                  detail.answered_in_app ? "In-app (TwiML App client)" : "Phone / forwarded",
                ],
                ["Client identity", detail.client_identity ?? "—"],
                ["Price", detail.price ?? "—"],
                ["Started", new Date(detail.started_at).toLocaleString()],
                ["Call SID", detail.sid],
                ...(detail.transcription ? [["Transcription", detail.transcription]] : []),
              ].map(([label, value]) => (
                <div
                  key={label as string}
                  className="flex items-start justify-between gap-3 rounded-2xl border border-border bg-secondary/40 px-3.5 py-2.5"
                >
                  <dt className="shrink-0 text-[0.7rem] tracking-wide text-muted-foreground uppercase">
                    {label}
                  </dt>
                  <dd className="tabular min-w-0 text-right break-words">{value}</dd>
                </div>
              ))}
            </dl>
          ) : null}
          {detail ? (
            <div className="mt-3 space-y-3">
              <CallSummaryCard
                callSid={detail.sid}
                contactNumber={otherParty(detail)}
                appNumber={detail.app_number}
              />
              {otherParty(detail) ? <CallerContextCard contactNumber={otherParty(detail)} /> : null}
              <AiCallTranscript callSid={detail.sid} />
            </div>
          ) : null}
          {detail ? (
            <Button
              className="key-call mt-3 h-12 w-full rounded-xl"
              disabled={!otherParty(detail)}
              onClick={() => void callBack(detail)}
            >
              <PhoneCall className="mr-2 h-4 w-4" />
              {otherParty(detail)
                ? `Call back ${formatPhone(otherParty(detail))}`
                : "Number unavailable"}
            </Button>
          ) : null}
          {detail && otherParty(detail) ? (
            <a
              href={`tel:${otherParty(detail)}`}
              className="key-raised mt-2 flex h-11 w-full items-center justify-center rounded-xl text-sm font-semibold"
            >
              <Smartphone className="mr-2 h-4 w-4" />
              Call on my cellular line
            </a>
          ) : null}
        </SheetContent>
      </Sheet>

      <Sheet open={dialing} onOpenChange={setDialing}>
        <SheetContent side="bottom" className="rounded-t-3xl border-border bg-card">
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
                <SelectTrigger className="h-11 w-full rounded-xl px-4">
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
              {selectedNumber?.outbound_caller_id ? (
                <p className="text-[0.7rem] text-muted-foreground">
                  Recipients see your verified caller ID{" "}
                  {formatPhone(selectedNumber.outbound_caller_id as string)}.
                </p>
              ) : null}
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
                ? "In-app call — connects right here using your caller ID."
                : savedCallback.trim()
                  ? `We'll ring ${formatPhone(savedCallback.trim())} first, then connect the contact.`
                  : `Direct call — dialing the contact from ${formatPhone(presentedCallerId)}. Add a callback number in Settings to be bridged instead.`}
            </p>
          </form>
        </SheetContent>
      </Sheet>
    </div>
  );
}
