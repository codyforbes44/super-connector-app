import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { errorMessage } from "@/lib/format";
import { listCallerRules, removeCallerRule, saveCallerRule } from "@/lib/receptionist.functions";

export type SpamPreviewRule = {
  id: string;
  phone_number: string;
  list: "allow" | "block";
  note: string | null;
};

export function SpamSettings({ preview }: { preview?: SpamPreviewRule[] }) {
  const queryClient = useQueryClient();
  const rules = useQuery({
    queryKey: ["caller-rules"],
    queryFn: () => listCallerRules(),
    enabled: !preview,
  });
  const rows = preview ?? rules.data ?? [];
  const [phone, setPhone] = useState(preview ? "" : "");
  const [list, setList] = useState<"allow" | "block">("block");

  const save = useMutation({
    mutationFn: () => saveCallerRule({ data: { phoneNumber: phone, list } }),
    onSuccess: async () => {
      setPhone("");
      toast.success(list === "block" ? "Blocked." : "Allowed.");
      await queryClient.invalidateQueries({ queryKey: ["caller-rules"] });
    },
    onError: (error) => toast.error(errorMessage(error)),
  });
  const remove = useMutation({
    mutationFn: (id: string) => removeCallerRule({ data: { id } }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["caller-rules"] });
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  return (
    <section className="glass-panel space-y-3 rounded-3xl p-4" aria-label="Spam settings">
      <div>
        <p className="font-display text-sm font-semibold">Spam</p>
        <p className="text-xs text-muted-foreground">
          Known spam never rings you and never uses AI minutes. Scoring uses Twilio Lookup line type
          and StirVerstat. Allow and block lists win.
        </p>
      </div>
      {preview ? null : (
        <div className="flex gap-2">
          <div className="min-w-0 flex-1 space-y-1.5">
            <Label className="sr-only">Phone number</Label>
            <Input
              value={phone}
              onChange={(event) => setPhone(event.target.value)}
              placeholder="+1…"
              className="h-11 rounded-xl"
            />
          </div>
          <Button
            type="button"
            variant="secondary"
            className="rounded-xl"
            onClick={() => setList(list === "block" ? "allow" : "block")}
          >
            {list === "block" ? "Block" : "Allow"}
          </Button>
          <Button
            type="button"
            className="rounded-xl"
            disabled={!phone.trim() || save.isPending}
            onClick={() => save.mutate()}
          >
            Add
          </Button>
        </div>
      )}
      <ul className="space-y-1.5">
        {rows.map((rule) => (
          <li
            key={rule.id}
            className="flex items-center justify-between gap-2 rounded-2xl bg-muted/30 px-3 py-2 text-sm"
          >
            <span className="tabular">{rule.phone_number}</span>
            <span className="text-xs text-muted-foreground">
              {rule.list === "block" ? "Blocked" : "Allowed"}
            </span>
            {preview ? null : (
              <button
                type="button"
                className="text-xs text-destructive"
                onClick={() => remove.mutate(rule.id)}
              >
                Remove
              </button>
            )}
          </li>
        ))}
        {rows.length === 0 ? (
          <li className="text-xs text-muted-foreground">No allow or block numbers yet.</li>
        ) : null}
      </ul>
    </section>
  );
}
