import { Ban, ShieldCheck } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  isSpamBlocked,
  spamFacts,
  type CallerListKind,
  type CallScreeningFields,
} from "@/lib/call-spam";

export function CallSpamPanel({
  call,
  phone,
  listStatus,
  pending,
  onSetList,
}: {
  call: CallScreeningFields;
  phone: string;
  listStatus: CallerListKind | null;
  pending: boolean;
  onSetList: (list: CallerListKind) => void;
}) {
  const blocked = isSpamBlocked(call);
  const facts = spamFacts(call);
  const canList = phone.trim().length > 0;
  if (!blocked && facts.length === 0 && !canList) return null;

  const listCopy =
    listStatus === "block"
      ? "This number is on your block list. Future calls will not ring."
      : listStatus === "allow"
        ? "This number is on your allow list. Future calls will ring."
        : "Not on your allow or block list yet.";

  return (
    <div className="mb-3 space-y-3">
      {blocked ? (
        <div className="rounded-2xl border border-warning/40 bg-warning/10 px-3.5 py-3">
          <p className="text-sm font-semibold">Spam blocked</p>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
            This call never rang your phone, and the receptionist did not pick up.
          </p>
        </div>
      ) : null}

      {facts.length > 0 ? (
        <dl className="space-y-1.5">
          {facts.map((fact) => (
            <div
              key={fact.label}
              className="flex items-start justify-between gap-3 rounded-2xl border border-border bg-secondary/40 px-3.5 py-2.5"
            >
              <dt className="shrink-0 text-[0.7rem] tracking-wide text-muted-foreground uppercase">
                {fact.label}
              </dt>
              <dd className="min-w-0 text-right text-sm break-words">{fact.value}</dd>
            </div>
          ))}
        </dl>
      ) : null}

      {canList ? (
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground">{listCopy}</p>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <Button
              type="button"
              variant={listStatus === "block" ? "destructive" : "outline"}
              className="h-11 rounded-xl"
              disabled={pending}
              aria-pressed={listStatus === "block"}
              onClick={() => onSetList("block")}
            >
              <Ban />
              {listStatus === "block" ? "Blocked" : "Block this number"}
            </Button>
            <Button
              type="button"
              variant={listStatus === "allow" ? "default" : "outline"}
              className="h-11 rounded-xl"
              disabled={pending}
              aria-pressed={listStatus === "allow"}
              onClick={() => onSetList("allow")}
            >
              <ShieldCheck />
              {listStatus === "allow" ? "Allowed" : "Allow this number"}
            </Button>
          </div>
          <p className="text-[0.7rem] leading-relaxed text-muted-foreground">
            Block stops future calls before they ring. Allow lets this number through even if it
            looks like spam.
          </p>
        </div>
      ) : null}
    </div>
  );
}
