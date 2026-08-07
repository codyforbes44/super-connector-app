import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowRight, Check, PhoneForwarded, Smartphone } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { ForwardingStatusCard } from "@/components/line/ForwardingStatusCard";
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
import { getMyForwarding, saveMyForwarding } from "@/lib/byo.functions";
import { errorMessage, formatPhone } from "@/lib/format";
import {
  CARRIERS,
  FORWARD_MODE_LABEL,
  carrierById,
  fillCode,
  stepsFor,
  type ForwardMode,
} from "@/lib/forwarding-codes";

export const forwardingQuery = {
  queryKey: ["my-forwarding"] as const,
  queryFn: () => getMyForwarding(),
};

export function BringYourOwnNumber({ lines }: { lines: Array<{ phone_number: string }> }) {
  const qc = useQueryClient();
  const current = useQuery(forwardingQuery);
  const [editing, setEditing] = useState(false);

  if (current.data && !editing) {
    return <ForwardingStatusCard row={current.data} onEdit={() => setEditing(true)} />;
  }

  return (
    <Wizard
      lines={lines}
      initial={current.data ?? null}
      onDone={async () => {
        await qc.invalidateQueries({ queryKey: ["my-forwarding"] });
        setEditing(false);
      }}
    />
  );
}

type Row = Awaited<ReturnType<typeof getMyForwarding>>;

function Wizard({
  lines,
  initial,
  onDone,
}: {
  lines: Array<{ phone_number: string }>;
  initial: Row;
  onDone: () => Promise<void>;
}) {
  const [step, setStep] = useState(0);
  const [personal, setPersonal] = useState(initial?.personal_number ?? "");
  const [mode, setMode] = useState<ForwardMode>(
    (initial?.forward_mode as ForwardMode) === "all" ? "all" : "conditional",
  );
  const [carrier, setCarrier] = useState(initial?.carrier ?? "att");
  const [line, setLine] = useState(
    initial?.assigned_number ?? lines[0]?.phone_number ?? "",
  );
  const [done, setDone] = useState<string[]>([]);

  const save = useMutation({
    mutationFn: () =>
      saveMyForwarding({
        data: {
          personalNumber: personal,
          carrier,
          forwardMode: mode,
          assignedNumber: line || null,
        },
      }),
    onSuccess: async () => {
      toast.success("Forwarding setup saved.");
      await onDone();
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  const steps = stepsFor(carrier, mode);
  const carrierMeta = carrierById(carrier);

  return (
    <div className="glass-panel space-y-4 rounded-3xl p-4">
      <div className="flex items-center gap-3">
        <span className="key-raised grid size-10 shrink-0 place-items-center rounded-full">
          <Smartphone className="size-4 text-primary" />
        </span>
        <div className="min-w-0">
          <p className="text-sm font-semibold">Keep your own number</p>
          <p className="text-xs text-muted-foreground">
            Your phone keeps ringing. SixVox picks up what you miss.
          </p>
        </div>
      </div>

      {step === 0 ? (
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="personal">Your existing phone number</Label>
            <Input
              id="personal"
              value={personal}
              onChange={(e) => setPersonal(e.target.value)}
              inputMode="tel"
              maxLength={20}
              placeholder="(580) 238-4777"
              className="h-11 rounded-full px-4"
            />
          </div>
          <div className="space-y-1.5">
            <Label>What should happen to your calls?</Label>
            {(["conditional", "all"] as const).map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => setMode(value)}
                className={`flex w-full items-start gap-3 rounded-2xl p-3 text-left text-xs transition ${
                  mode === value ? "key-raised text-foreground" : "bg-muted/30 text-muted-foreground"
                }`}
              >
                <PhoneForwarded className="mt-0.5 size-4 text-primary" />
                <span>
                  <span className="block font-semibold">{FORWARD_MODE_LABEL[value]}</span>
                  <span className="opacity-70">
                    {value === "conditional"
                      ? "Busy, no answer or out of signal go to SixVox."
                      : "SixVox answers first and takes a message for you."}
                  </span>
                </span>
              </button>
            ))}
          </div>
          <Button
            className="key-signal h-11 w-full rounded-full font-semibold"
            disabled={personal.replace(/\D/g, "").length < 10}
            onClick={() => setStep(1)}
          >
            Continue
            <ArrowRight className="ml-1.5 size-4" />
          </Button>
        </div>
      ) : null}

      {step === 1 ? (
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>Your phone carrier</Label>
            <Select value={carrier} onValueChange={setCarrier}>
              <SelectTrigger className="h-11 w-full rounded-full px-4">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CARRIERS.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Forward to this SixVox line</Label>
            {lines.length ? (
              <Select value={line} onValueChange={setLine}>
                <SelectTrigger className="h-11 w-full rounded-full px-4">
                  <SelectValue placeholder="Pick a line" />
                </SelectTrigger>
                <SelectContent>
                  {lines.map((l) => (
                    <SelectItem key={l.phone_number} value={l.phone_number}>
                      {formatPhone(l.phone_number)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <p className="text-xs text-muted-foreground">
                You don&apos;t have a SixVox line yet. Pick one first, or ask support to set one up
                for you — then come back here.
              </p>
            )}
          </div>
          <Button
            className="key-signal h-11 w-full rounded-full font-semibold"
            disabled={!line}
            onClick={() => setStep(2)}
          >
            Show me the steps
            <ArrowRight className="ml-1.5 size-4" />
          </Button>
        </div>
      ) : null}

      {step === 2 ? (
        <div className="space-y-3">
          <p className="text-xs text-muted-foreground">
            Tap each code below on this phone and press call. You&apos;ll hear a short confirmation,
            then hang up.
          </p>
          {carrierMeta.note ? (
            <p className="rounded-2xl bg-muted/30 p-3 text-[0.7rem] text-muted-foreground">
              {carrierMeta.note}
            </p>
          ) : null}
          <ul className="space-y-2">
            {steps.map((s) => {
              const code = fillCode(s.on, line);
              const finished = done.includes(s.id);
              return (
                <li key={s.id} className="rounded-2xl bg-muted/30 p-3">
                  <p className="text-xs font-semibold">{s.label}</p>
                  <p className="text-[0.7rem] text-muted-foreground">{s.hint}</p>
                  <div className="mt-2 flex items-center gap-2">
                    <a
                      href={`tel:${encodeURIComponent(code)}`}
                      className="key-call tabular flex-1 rounded-full px-4 py-2 text-center text-sm font-semibold"
                      onClick={() => setDone((d) => (d.includes(s.id) ? d : [...d, s.id]))}
                    >
                      {code}
                    </a>
                    <button
                      type="button"
                      aria-label="Mark as done"
                      onClick={() => setDone((d) => (d.includes(s.id) ? d : [...d, s.id]))}
                      className={`grid size-9 shrink-0 place-items-center rounded-full ${
                        finished ? "key-signal" : "key-raised text-muted-foreground"
                      }`}
                    >
                      <Check className="size-4" />
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
          <Button
            className="key-signal h-11 w-full rounded-full font-semibold"
            disabled={save.isPending}
            onClick={() => save.mutate()}
          >
            {save.isPending ? "Saving…" : "I've set up forwarding"}
          </Button>
          <p className="text-center text-[0.7rem] text-muted-foreground">
            Ask a friend to call you and let it ring — as soon as the first call reaches SixVox
            we&apos;ll mark this verified.
          </p>
        </div>
      ) : null}
    </div>
  );
}