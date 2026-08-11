import { useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, Clock, PhoneOff, Pencil, RefreshCw } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { stopMyForwarding } from "@/lib/byo.functions";
import { errorMessage, formatPhone } from "@/lib/format";
import {
  FORWARD_MODE_LABEL,
  carrierById,
  fillCode,
  stepsFor,
  type ForwardMode,
} from "@/lib/forwarding-codes";

type Row = {
  personal_number: string;
  carrier: string | null;
  forward_mode: string;
  assigned_number: string | null;
  status: string;
  last_forwarded_call_at: string | null;
};

export function ForwardingStatusCard({ row, onEdit }: { row: Row; onEdit: () => void }) {
  const qc = useQueryClient();
  const [checking, setChecking] = useState(false);
  const mode: ForwardMode = row.forward_mode === "all" ? "all" : "conditional";
  const verified = row.status === "verified";
  const off = row.status === "off";
  const steps = stepsFor(row.carrier, mode);

  return (
    <div className="glass-panel space-y-4 rounded-3xl p-4">
      <div className="flex items-start gap-3">
        <span className="key-raised grid size-10 shrink-0 place-items-center rounded-full">
          {off ? (
            <PhoneOff className="size-4 text-muted-foreground" />
          ) : verified ? (
            <CheckCircle2 className="size-4 text-success" />
          ) : (
            <Clock className="size-4 text-primary" />
          )}
        </span>
        <div className="min-w-0 flex-1">
          <p className="tabular text-sm font-semibold">{formatPhone(row.personal_number)}</p>
          <p className="text-xs text-muted-foreground">
            {off
              ? "Forwarding turned off"
              : verified
                ? `Answered by SixVox on ${formatPhone(row.assigned_number ?? "")}`
                : "Waiting for your first forwarded call"}
          </p>
          <p className="mt-0.5 text-[0.7rem] text-muted-foreground">
            {FORWARD_MODE_LABEL[mode]} · {carrierById(row.carrier).name}
          </p>
        </div>
        <button
          type="button"
          aria-label="Edit forwarding"
          onClick={onEdit}
          className="key-raised grid size-9 shrink-0 place-items-center rounded-full text-muted-foreground"
        >
          <Pencil className="size-4" />
        </button>
      </div>

      {row.last_forwarded_call_at ? (
        <p className="text-[0.7rem] text-muted-foreground">
          Last forwarded call {new Date(row.last_forwarded_call_at).toLocaleString()}
        </p>
      ) : null}

      {!off ? (
        <details className="rounded-2xl bg-muted/30 p-3">
          <summary className="cursor-pointer text-xs font-semibold">Stop forwarding</summary>
          <p className="mt-2 text-[0.7rem] text-muted-foreground">
            Dial these on your phone to send calls back to your own voicemail.
          </p>
          <ul className="mt-2 space-y-1.5">
            {steps.map((s) => (
              <li key={s.id}>
                <a
                  href={`tel:${encodeURIComponent(s.off)}`}
                  className="key-raised tabular block rounded-full px-4 py-2 text-center text-sm font-semibold"
                >
                  {s.off}
                </a>
              </li>
            ))}
          </ul>
          <Button
            variant="ghost"
            className="key-end mt-3 h-10 w-full rounded-full"
            onClick={async () => {
              try {
                await stopMyForwarding();
                await qc.invalidateQueries({ queryKey: ["my-forwarding"] });
                toast.success("Forwarding marked as off.");
              } catch (error) {
                toast.error(errorMessage(error));
              }
            }}
          >
            I&apos;ve turned it off
          </Button>
        </details>
      ) : null}

      {!verified && !off ? (
        <div className="space-y-2 rounded-2xl bg-muted/30 p-3">
          <p className="text-[0.7rem] text-muted-foreground">
            Test it: call your own number from another phone and let it ring out. As soon as the
            call reaches SixVox this turns green.
          </p>
          <Button
            variant="ghost"
            className="key-raised h-10 w-full rounded-full text-xs font-semibold"
            disabled={checking}
            onClick={async () => {
              setChecking(true);
              try {
                await qc.invalidateQueries({ queryKey: ["my-forwarding"] });
                toast.message("Checked — we'll flip this to verified on the first forwarded call.");
              } finally {
                setChecking(false);
              }
            }}
          >
            <RefreshCw className={`mr-2 size-3.5 ${checking ? "animate-spin" : ""}`} />
            I made a test call — check now
          </Button>
        </div>
      ) : null}

      {!off && steps[0] ? (
        <p className="text-[0.7rem] text-muted-foreground">
          Re-dial{" "}
          <span className="tabular font-semibold">
            {fillCode(steps[0].on, row.assigned_number ?? "")}
          </span>{" "}
          if you ever swap SIM or reset your phone.
        </p>
      ) : null}
    </div>
  );
}