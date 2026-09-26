import {
  ArrowDownLeft,
  ArrowUpRight,
  Ban,
  PhoneCall,
  Play,
  ShieldCheck,
  Smartphone,
} from "lucide-react";

import { duration, formatPhone, relativeTime } from "@/lib/format";
import {
  callStory,
  isSpamBlocked,
  otherPartyNumber,
  type CallerListKind,
  type CallScreeningFields,
} from "@/lib/call-spam";
import { cn } from "@/lib/utils";

type CallRowView = CallScreeningFields & {
  id: string;
  started_at: string;
  duration?: number | null;
  recording_url?: string | null;
  answered_in_app?: boolean | null;
  sid: string;
};

export function CallHistoryRow({
  call,
  listStatus,
  pending,
  onOpen,
  onPlay,
  onCallBack,
  onSetList,
}: {
  call: CallRowView;
  listStatus: CallerListKind | null;
  pending: boolean;
  onOpen: () => void;
  onPlay: () => void;
  onCallBack: () => void;
  onSetList: (list: CallerListKind) => void;
}) {
  const inbound = call.direction === "inbound";
  const other = inbound ? call.from_number : call.to_number;
  const phone = otherPartyNumber(call);
  const spam = isSpamBlocked(call);
  const missed = !spam && ["no-answer", "failed", "busy", "canceled"].includes(call.status ?? "");

  return (
    <div className="min-w-0 px-4 py-3">
      <div className="flex min-h-[4.5rem] min-w-0 items-center gap-2.5 sm:gap-3">
        <button
          type="button"
          onClick={onOpen}
          className="flex min-w-0 flex-1 items-center gap-2.5 text-left sm:gap-3"
        >
          <span
            className={cn(
              "flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl",
              spam
                ? "bg-warning/15 text-warning"
                : missed
                  ? "bg-destructive/15 text-destructive"
                  : inbound
                    ? "bg-success/15 text-success"
                    : "bg-primary/15 text-primary",
            )}
          >
            {inbound ? <ArrowDownLeft className="h-4 w-4" /> : <ArrowUpRight className="h-4 w-4" />}
          </span>
          <div className="min-w-0 flex-1">
            <p
              className={cn(
                "flex min-w-0 items-center gap-1.5 text-[0.95rem]",
                missed ? "font-semibold" : "font-medium",
              )}
            >
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
              {spam ? (
                <span className="shrink-0 rounded-full bg-warning/15 px-2 py-0.5 text-[0.65rem] font-semibold text-warning">
                  Spam blocked
                </span>
              ) : missed ? (
                <span className="shrink-0 rounded-full bg-destructive/15 px-2 py-0.5 text-[0.65rem] font-semibold text-destructive">
                  Missed call
                </span>
              ) : call.recording_url ? (
                <span className="shrink-0 rounded-full bg-primary/15 px-2 py-0.5 text-[0.65rem] font-semibold text-primary">
                  Voicemail
                </span>
              ) : null}
              <span
                className={cn("truncate", missed && "text-destructive", spam && "text-warning")}
              >
                {callStory(call)}
              </span>
              {call.duration ? <span className="tabular"> · {duration(call.duration)}</span> : null}
            </p>
          </div>
        </button>
        <button
          type="button"
          onClick={onPlay}
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-secondary/70 text-foreground"
        >
          <Play className="h-4 w-4" />
          <span className="sr-only">Play voicemail</span>
        </button>
        <button
          type="button"
          disabled={!phone}
          onClick={onCallBack}
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-success/15 text-success disabled:opacity-40"
        >
          <PhoneCall className="h-4 w-4" />
          <span className="sr-only">Call back {phone || "unavailable"}</span>
        </button>
      </div>
      {spam && phone ? (
        <div className="mt-2 flex flex-wrap gap-2 pl-12">
          <button
            type="button"
            disabled={pending}
            aria-pressed={listStatus === "block"}
            onClick={() => onSetList("block")}
            className="inline-flex h-11 items-center gap-1.5 rounded-full bg-destructive/15 px-3 text-[0.72rem] font-semibold text-destructive disabled:opacity-50"
          >
            <Ban className="h-3.5 w-3.5" />
            {listStatus === "block" ? "Blocked" : "Block this number"}
          </button>
          <button
            type="button"
            disabled={pending}
            aria-pressed={listStatus === "allow"}
            onClick={() => onSetList("allow")}
            className="inline-flex h-11 items-center gap-1.5 rounded-full bg-success/15 px-3 text-[0.72rem] font-semibold text-success disabled:opacity-50"
          >
            <ShieldCheck className="h-3.5 w-3.5" />
            {listStatus === "allow" ? "Allowed" : "Allow this number"}
          </button>
        </div>
      ) : null}
    </div>
  );
}
