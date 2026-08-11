import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Ban, ShieldQuestion, Star, X } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { errorMessage, formatPhone } from "@/lib/format";
import {
  deleteCallerRule,
  listCallerRules,
  saveCallerRule,
} from "@/lib/intelligence.functions";

type Behavior = "vip" | "screen" | "block";

const META: Record<Behavior, { label: string; hint: string; icon: typeof Star }> = {
  vip: { label: "Always ring me", hint: "Rings through, even in quiet hours", icon: Star },
  screen: { label: "Screen first", hint: "Assistant answers and asks who's calling", icon: ShieldQuestion },
  block: { label: "Decline silently", hint: "Never rings your phone", icon: Ban },
};

export function CallerRules() {
  const qc = useQueryClient();
  const rules = useQuery({ queryKey: ["caller-rules"], queryFn: () => listCallerRules() });
  const [number, setNumber] = useState("");
  const [behavior, setBehavior] = useState<Behavior>("vip");

  const save = useMutation({
    mutationFn: () => saveCallerRule({ data: { contactNumber: number.trim(), behavior } }),
    onSuccess: async () => {
      setNumber("");
      await qc.invalidateQueries({ queryKey: ["caller-rules"] });
      toast.success("Rule saved.");
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  const remove = useMutation({
    mutationFn: (id: string) => deleteCallerRule({ data: { id } }),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["caller-rules"] });
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  return (
    <section className="space-y-3 border-t border-border px-4 py-4">
      <h2 className="font-display text-sm font-semibold">Who gets through</h2>
      <p className="text-[0.7rem] text-muted-foreground">
        Pick how specific numbers are treated when they call you.
      </p>

      <div className="flex flex-col gap-2 sm:flex-row">
        <Input
          value={number}
          onChange={(event) => setNumber(event.target.value)}
          inputMode="tel"
          placeholder="+1 555 010 1234"
          className="h-11 rounded-full px-4"
        />
        <Select value={behavior} onValueChange={(value) => setBehavior(value as Behavior)}>
          <SelectTrigger className="h-11 rounded-full px-4 sm:w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {(Object.keys(META) as Behavior[]).map((key) => (
              <SelectItem key={key} value={key}>
                {META[key].label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button
          className="key-signal h-11 rounded-full sm:px-6"
          disabled={!number.trim() || save.isPending}
          onClick={() => save.mutate()}
        >
          Add
        </Button>
      </div>

      <ul className="space-y-2">
        {(rules.data ?? []).map((rule) => {
          const meta = META[(rule.behavior as Behavior) ?? "screen"] ?? META.screen;
          const Icon = meta.icon;
          return (
            <li key={rule.id} className="glass-panel flex items-center gap-3 rounded-2xl px-3.5 py-2.5">
              <Icon className="size-4 shrink-0 text-primary" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">
                  {rule.label || formatPhone(rule.contact_number as string)}
                </p>
                <p className="truncate text-[0.7rem] text-muted-foreground">{meta.hint}</p>
              </div>
              <button
                type="button"
                aria-label="Remove rule"
                onClick={() => remove.mutate(rule.id as string)}
                className="key-raised grid size-9 shrink-0 place-items-center rounded-full"
              >
                <X className="size-4" />
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}