import { Switch } from "@/components/ui/switch";

export function RecordingToggle({
  enabled,
  disabled,
  onChange,
}: {
  enabled: boolean;
  disabled?: boolean;
  onChange: (enabled: boolean) => void;
}) {
  return (
    <div className="space-y-2 rounded-2xl border border-border bg-card px-3.5 py-3">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-medium">Record calls</p>
          <p className="text-xs text-muted-foreground">Off unless you turn it on for this line.</p>
        </div>
        <Switch
          checked={enabled}
          disabled={disabled}
          onCheckedChange={onChange}
          aria-label="Record calls on this line"
        />
      </div>
      <p className="text-xs text-muted-foreground">
        When this is on, inbound calls, outbound calls, voicemail, and the AI receptionist play
        “This call may be recorded” to everyone on the call before recording starts. The assistant
        also says it is an automated assistant. SixVox uses all-party consent everywhere, including
        one-party states.
      </p>
    </div>
  );
}
