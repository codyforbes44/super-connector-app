import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Filter, Smartphone, PhoneCall, PhoneOff, PhoneOutgoing, RefreshCw } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

import { ScreenHeader, useScreenFab } from "@/components/AppShell";
import { CallHistoryRow } from "@/components/calls/CallHistoryRow";
import { CallSpamPanel } from "@/components/calls/CallSpamPanel";
import { E911Disclosure } from "@/components/marketing/Disclosures";
import { AsyncList, Empty, ListGroup, Screen } from "@/components/screen";
import { AiCallTranscript } from "@/components/AiCallTranscript";
import { CallSummaryCard } from "@/components/intelligence/CallSummaryCard";
import { PendingBookings } from "@/components/line/PendingBookings";
import { CallerContextCard } from "@/components/intelligence/CallerContextCard";
import { CallFilters, type CallFilterState } from "@/components/CallFilters";
import { CallReadiness } from "@/components/CallReadiness";
import { DialerE911Warning } from "@/components/compliance/DialerE911Warning";
import { Dialpad } from "@/components/Dialpad";
import { getE911Gate } from "@/lib/compliance.functions";
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
import {
  NOT_SPAM_ORS,
  SPAM_BLOCKED_OR,
  callerListForNumber,
  hasCallFilters,
  isSpamBlocked,
  matchesScreening,
  otherPartyNumber,
  type CallerListKind,
} from "@/lib/call-spam";
import { duration, errorMessage, formatPhone } from "@/lib/format";
import { listCallerRules, saveCallerRule } from "@/lib/receptionist.functions";
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
  validateSearch: (search: Record<string, unknown>): CallSearch => {
    const pick = <T extends string>(raw: unknown, allowed: readonly T[], fallback: T): T =>
      allowed.includes(raw as T) ? (raw as T) : fallback;
    return {
      q: typeof search["q"] === "string" ? search["q"] : "",
      direction: pick(search["direction"], ["all", "inbound", "outbound"] as const, "all"),
      range: pick(search["range"], ["all", "today", "7d", "30d"] as const, "all"),
      device: pick(search["device"], ["all", "app", "phone"] as const, "all"),
      screening: pick(search["screening"], ["all", "spam", "normal"] as const, "all"),
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
  const e911 = useQuery({
    queryKey: ["e911-gate"],
    queryFn: () => getE911Gate(),
  });
  const e911Acknowledged = e911.data?.acknowledged === true;
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
      switch (filters.screening) {
        case "spam":
          query = query.or(SPAM_BLOCKED_OR);
          break;
        case "normal":
          for (const clause of NOT_SPAM_ORS) query = query.or(clause);
          break;
        case "all":
          break;
        default: {
          const unreachable: never = filters.screening;
          throw new Error(unreachable);
        }
      }

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
      return data.filter((row) => matchesScreening(row, filters.screening));
    },
  });

  const callerLists = useQuery({
    queryKey: ["caller-lists"],
    queryFn: () => listCallerRules(),
  });

  const setCallerList = useMutation({
    mutationFn: (input: { phoneNumber: string; list: CallerListKind }) =>
      saveCallerRule({ data: input }),
    onSuccess: async (_result, input) => {
      toast.success(
        input.list === "block"
          ? "Blocked. Future calls from this number won't ring."
          : "Allowed. Future calls from this number will ring.",
      );
      await queryClient.invalidateQueries({ queryKey: ["caller-lists"] });
      await queryClient.invalidateQueries({ queryKey: ["caller-rules"] });
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  function listStatusFor(phone: string): CallerListKind | null {
    return callerListForNumber(callerLists.data ?? [], phone);
  }

  function setList(phone: string, list: CallerListKind) {
    if (!phone || setCallerList.isPending) return;
    setCallerList.mutate({ phoneNumber: phone, list });
  }

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
    if (!e911Acknowledged) {
      toast.error("Acknowledge the 911 limitations before placing a call.");
      return;
    }
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
    const target = otherPartyNumber(call);
    if (!target) return;
    if (!e911Acknowledged) {
      toast.error("Acknowledge the 911 limitations before placing a call.");
      return;
    }
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
        subtitle="Blocked spam is marked so you don't call it back by mistake"
        action={
          <Button size="icon" variant="ghost" onClick={sync} disabled={syncing}>
            <RefreshCw className={cn("h-4 w-4", syncing && "animate-spin")} />
            <span className="sr-only">Sync call history</span>
          </Button>
        }
      />

      <CallFilters value={filters} onChange={setFilters} />

      <PendingBookings />

      <Screen onRefresh={sync}>
        <CallReadiness />

        {ringHint && voice.callState === "idle" ? (
          <p className="mb-3 rounded-lg border border-border bg-card px-3.5 py-2.5 text-xs text-muted-foreground">
            Connecting the incoming call to this device…
          </p>
        ) : null}

        {audio ? (
          <div className="mb-3 rounded-lg border border-border bg-card p-3">
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
              icon={hasCallFilters(filters) ? Filter : PhoneCall}
              title={hasCallFilters(filters) ? "No matching calls" : "No calls on this line yet"}
              description={
                hasCallFilters(filters)
                  ? "Clear a filter or search a different number."
                  : "When a customer calls while you're on a job, it shows up here. Missed calls are marked in red. Spam that never rang is marked so you don't treat it like a missed customer."
              }
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
                const phone = otherPartyNumber(call);
                return (
                  <CallHistoryRow
                    key={call.id}
                    call={call}
                    listStatus={phone ? listStatusFor(phone) : null}
                    pending={setCallerList.isPending}
                    onOpen={() => setDetail(call)}
                    onPlay={() => void playVoicemail(call.sid)}
                    onCallBack={() => void callBack(call)}
                    onSetList={(list) => setList(phone, list)}
                  />
                );
              })}
            </ListGroup>
          )}
        </AsyncList>
      </Screen>

      <Sheet open={detail !== null} onOpenChange={(open) => !open && setDetail(null)}>
        <SheetContent
          side="bottom"
          className="max-h-[85dvh] overflow-y-auto rounded-t-lg border-border bg-card pb-[calc(env(safe-area-inset-bottom)+1rem)]"
        >
          <SheetHeader className="px-0">
            <SheetTitle className="font-display text-center">Call details</SheetTitle>
          </SheetHeader>
          {detail ? (
            <CallSpamPanel
              call={detail}
              phone={otherPartyNumber(detail)}
              listStatus={listStatusFor(otherPartyNumber(detail))}
              pending={setCallerList.isPending}
              onSetList={(list) => setList(otherPartyNumber(detail), list)}
            />
          ) : null}
          {detail ? (
            <dl className="space-y-1.5 text-sm">
              {[
                ["From", formatPhone(detail.from_number)],
                ["To", formatPhone(detail.to_number)],
                ["Twilio number", formatPhone(detail.app_number)],
                ["Direction", detail.direction],
                ["Status", isSpamBlocked(detail) ? "Spam blocked" : (detail.status ?? "—")],
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
                  className="flex items-start justify-between gap-3 border-b border-border px-3.5 py-2.5 last:border-0"
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
                contactNumber={otherPartyNumber(detail)}
                appNumber={detail.app_number}
              />
              {otherPartyNumber(detail) ? (
                <CallerContextCard contactNumber={otherPartyNumber(detail)} />
              ) : null}
              <AiCallTranscript callSid={detail.sid} />
            </div>
          ) : null}
          {detail ? (
            <Button
              className="key-call mt-3 h-12 w-full rounded-xl"
              disabled={!otherPartyNumber(detail)}
              onClick={() => void callBack(detail)}
            >
              <PhoneCall className="mr-2 h-4 w-4" />
              {otherPartyNumber(detail)
                ? `Call back ${formatPhone(otherPartyNumber(detail))}`
                : "Number unavailable"}
            </Button>
          ) : null}
          {detail && otherPartyNumber(detail) ? (
            <a
              href={`tel:${otherPartyNumber(detail)}`}
              className="key-raised mt-2 flex h-11 w-full items-center justify-center rounded-xl text-sm font-semibold"
            >
              <Smartphone className="mr-2 h-4 w-4" />
              Call on my cellular line
            </a>
          ) : null}
        </SheetContent>
      </Sheet>

      <Sheet open={dialing} onOpenChange={setDialing}>
        <SheetContent side="bottom" className="rounded-t-lg border-border bg-card">
          <SheetHeader className="px-0">
            <SheetTitle className="font-display text-center">Dialer</SheetTitle>
          </SheetHeader>
          <form onSubmit={dial} className="space-y-5 pb-[calc(env(safe-area-inset-bottom)+1rem)]">
            <DialerE911Warning acknowledged={e911Acknowledged} />
            <Dialpad value={to} onChange={setTo} />
            <E911Disclosure className="text-center text-[0.7rem] leading-relaxed text-muted-foreground" />

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
              <Button
                type="button"
                onClick={() => setDialing(false)}
                aria-label="Close dialer"
                title="Close dialer"
                className="key-end h-16 w-16 rounded-full transition-transform active:scale-95"
              >
                <PhoneOff className="h-6 w-6" />
              </Button>
              <Button
                type="submit"
                disabled={!to.trim() || !e911Acknowledged}
                aria-label="Connect call"
                title="Connect call"
                className="key-call h-16 w-16 rounded-full transition-transform active:scale-95 disabled:opacity-40"
              >
                <PhoneCall className="h-6 w-6" />
              </Button>
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
