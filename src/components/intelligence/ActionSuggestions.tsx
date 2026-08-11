import { useMutation } from "@tanstack/react-query";
import { CalendarPlus, Check, MessageSquare, NotebookPen, PhoneCall, Pin, UserPlus } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { errorMessage } from "@/lib/format";
import { applySuggestedAction } from "@/lib/intelligence.functions";

export type SuggestedAction = { kind: string; label: string; value?: string };

const ICONS: Record<string, typeof UserPlus> = {
  save_contact: UserPlus,
  save_place: Pin,
  calendar_event: CalendarPlus,
  send_sms: MessageSquare,
  send_email: MessageSquare,
  call_back: PhoneCall,
  note: NotebookPen,
};

export function ActionSuggestions({
  items,
  callSid,
  contactNumber,
  appNumber,
}: {
  items: SuggestedAction[];
  callSid: string;
  contactNumber: string | null;
  appNumber: string | null;
}) {
  const [done, setDone] = useState<Record<number, boolean>>({});

  const run = useMutation({
    mutationFn: (input: { index: number; action: SuggestedAction }) =>
      applySuggestedAction({
        data: {
          kind: input.action.kind,
          ...(input.action.value ? { value: input.action.value } : {}),
          ...(contactNumber ? { contactNumber } : {}),
          ...(appNumber ? { appNumber } : {}),
          callSid,
        },
      }),
    onSuccess: (result, input) => {
      setDone((prev) => ({ ...prev, [input.index]: true }));
      toast.success(result.message ?? "Done.");
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  const usable = items.filter((item) => item.label?.trim());
  if (!usable.length) return null;

  return (
    <div className="space-y-1.5">
      <p className="text-[0.65rem] tracking-wide text-muted-foreground uppercase">Follow up</p>
      <ul className="grid gap-1.5">
        {usable.map((action, index) => {
          const Icon = ICONS[action.kind] ?? NotebookPen;
          const complete = done[index];
          return (
            <li key={`${action.kind}-${index}`}>
              <button
                type="button"
                disabled={complete || run.isPending}
                onClick={() => run.mutate({ index, action })}
                className="key-raised flex min-h-11 w-full items-center gap-2.5 rounded-2xl px-3 text-left text-sm disabled:opacity-60"
              >
                {complete ? (
                  <Check className="size-4 shrink-0 text-success" />
                ) : (
                  <Icon className="size-4 shrink-0 text-primary" />
                )}
                <span className="min-w-0 flex-1 truncate">{action.label}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}