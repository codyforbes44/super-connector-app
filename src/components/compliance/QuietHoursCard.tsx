import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

export type QuietHoursValue = {
  enabled: boolean;
  quietStart: string;
  quietEnd: string;
  timezone: string;
};

export function QuietHoursCard({
  value,
  busy,
  onChange,
  onSave,
}: {
  value: QuietHoursValue;
  busy?: boolean;
  onChange: (value: QuietHoursValue) => void;
  onSave: () => void;
}) {
  return (
    <section className="space-y-3 border-t border-border px-4 py-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-sm font-semibold">Quiet hours for automated texts</h2>
          <p className="text-xs text-muted-foreground">
            Follow-ups, review requests, and marketing texts wait. A text you send yourself from the
            inbox is not held.
          </p>
        </div>
        <Switch
          checked={value.enabled}
          onCheckedChange={(enabled) => onChange({ ...value, enabled })}
          aria-label="Enable quiet hours for automated texts"
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="quiet-start">Starts</Label>
          <Input
            id="quiet-start"
            type="time"
            value={value.quietStart}
            onChange={(event) => onChange({ ...value, quietStart: event.target.value })}
            className="h-11 rounded-xl"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="quiet-end">Ends</Label>
          <Input
            id="quiet-end"
            type="time"
            value={value.quietEnd}
            onChange={(event) => onChange({ ...value, quietEnd: event.target.value })}
            className="h-11 rounded-xl"
          />
        </div>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="quiet-tz">Timezone</Label>
        <Input
          id="quiet-tz"
          value={value.timezone}
          onChange={(event) => onChange({ ...value, timezone: event.target.value })}
          className="h-11 rounded-xl"
        />
      </div>
      <Button className="h-11 rounded-xl" disabled={busy} onClick={onSave}>
        {busy ? "Saving…" : "Save quiet hours"}
      </Button>
    </section>
  );
}
