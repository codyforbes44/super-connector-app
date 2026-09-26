import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";

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
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  DAY_KEYS,
  DEFAULT_BUSINESS_TIMEZONE,
  DEFAULT_WEEKLY_SCHEDULE,
  type AfterHoursDestination,
  type WeeklySchedule,
} from "@/lib/business-hours";
import { DEFAULT_EMERGENCY_KEYWORDS } from "@/lib/emergency-keywords";
import { errorMessage } from "@/lib/format";
import { getLineAutomation, saveLineAutomation } from "@/lib/line-automation.functions";
import { DEFAULT_TEXT_BACK_DEDUPE_MINUTES, DEFAULT_TEXT_BACK_TEMPLATE } from "@/lib/missed-call";

const DAY_LABEL: Record<(typeof DAY_KEYS)[number], string> = {
  sun: "Sunday",
  mon: "Monday",
  tue: "Tuesday",
  wed: "Wednesday",
  thu: "Thursday",
  fri: "Friday",
  sat: "Saturday",
};

const TIMEZONES = [
  "America/Chicago",
  "America/New_York",
  "America/Denver",
  "America/Los_Angeles",
  "America/Phoenix",
  "UTC",
];

type Draft = {
  textBackEnabled: boolean;
  textBackTemplate: string;
  textBackOnAi: boolean;
  textBackOnVoicemail: boolean;
  textBackDedupeMinutes: number;
  businessHoursEnabled: boolean;
  businessTimezone: string;
  schedule: WeeklySchedule;
  holidays: string;
  afterHours: AfterHoursDestination;
  emergencyKeywords: string;
  emergencyTransferNumber: string;
  textingNotice: string | null;
};

function emptyDraft(): Draft {
  return {
    textBackEnabled: false,
    textBackTemplate: DEFAULT_TEXT_BACK_TEMPLATE,
    textBackOnAi: false,
    textBackOnVoicemail: false,
    textBackDedupeMinutes: DEFAULT_TEXT_BACK_DEDUPE_MINUTES,
    businessHoursEnabled: false,
    businessTimezone: DEFAULT_BUSINESS_TIMEZONE,
    schedule: DEFAULT_WEEKLY_SCHEDULE,
    holidays: "",
    afterHours: "ai",
    emergencyKeywords: DEFAULT_EMERGENCY_KEYWORDS.join("\n"),
    emergencyTransferNumber: "",
    textingNotice: null,
  };
}

export function LineAutomationSettings({
  sid,
  preview,
}: {
  sid: string;
  preview?: Draft & { textingRegistered: boolean };
}) {
  const query = useQuery({
    queryKey: ["line-automation", sid],
    queryFn: () => getLineAutomation({ data: { sid } }),
    enabled: !preview,
  });
  const [draft, setDraft] = useState<Draft>(preview ?? emptyDraft());
  const [busy, setBusy] = useState(false);
  const [loaded, setLoaded] = useState(Boolean(preview));

  useEffect(() => {
    if (!query.data) return;
    setDraft({
      textBackEnabled: query.data.textBackEnabled,
      textBackTemplate: query.data.textBackTemplate,
      textBackOnAi: query.data.textBackOnAi,
      textBackOnVoicemail: query.data.textBackOnVoicemail,
      textBackDedupeMinutes: query.data.textBackDedupeMinutes,
      businessHoursEnabled: query.data.businessHoursEnabled,
      businessTimezone: query.data.businessTimezone,
      schedule: query.data.schedule,
      holidays: query.data.holidays.join("\n"),
      afterHours: query.data.afterHours,
      emergencyKeywords: query.data.emergencyKeywords.join("\n"),
      emergencyTransferNumber: query.data.emergencyTransferNumber ?? "",
      textingNotice: query.data.textingNotice,
    });
    setLoaded(true);
  }, [query.data]);

  const zones = TIMEZONES.includes(draft.businessTimezone)
    ? TIMEZONES
    : [draft.businessTimezone, ...TIMEZONES];

  async function save() {
    if (preview) {
      toast.success("Preview only — nothing was saved.");
      return;
    }
    setBusy(true);
    try {
      const saved = await saveLineAutomation({
        data: {
          sid,
          textBackEnabled: draft.textBackEnabled,
          textBackTemplate: draft.textBackTemplate,
          textBackOnAi: draft.textBackOnAi,
          textBackOnVoicemail: draft.textBackOnVoicemail,
          textBackDedupeMinutes: draft.textBackDedupeMinutes,
          businessHoursEnabled: draft.businessHoursEnabled,
          businessTimezone: draft.businessTimezone,
          schedule: draft.schedule,
          holidays: draft.holidays
            .split(/[\n,]/)
            .map((line) => line.trim())
            .filter(Boolean),
          afterHours: draft.afterHours,
          emergencyKeywords: draft.emergencyKeywords
            .split("\n")
            .map((line) => line.trim())
            .filter(Boolean),
          emergencyTransferNumber: draft.emergencyTransferNumber.trim() || null,
        },
      });
      toast.success(
        saved.transferSync.synced
          ? "Line automation saved. Emergency transfer is on the AI agent."
          : `Line automation saved. ${saved.transferSync.detail}`,
      );
      await query.refetch();
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4 rounded-2xl border border-border p-4" data-testid="line-automation">
      <div>
        <h3 className="font-display text-sm font-semibold">Missed-call text-back</h3>
        <p className="mt-1 text-xs text-muted-foreground">
          When an inbound call ends unanswered, SixVox texts the caller from this line. Use{" "}
          {"{{line}}"} and {"{{caller}}"} in the message.
        </p>
      </div>

      {draft.textingNotice ? (
        <p
          className="rounded-xl border border-warning/40 bg-warning/10 px-3 py-2 text-sm text-warning"
          data-testid="texting-unregistered"
        >
          {draft.textingNotice}
        </p>
      ) : null}

      {!loaded && query.isLoading ? (
        <p className="text-sm text-muted-foreground">Loading line automation…</p>
      ) : null}
      {query.error ? <p className="text-sm text-destructive">{errorMessage(query.error)}</p> : null}

      <Toggle
        id="text-back-enabled"
        label="Text callers we missed"
        checked={draft.textBackEnabled}
        onCheckedChange={(textBackEnabled) => setDraft({ ...draft, textBackEnabled })}
        testId="text-back-enabled"
      />
      <div className="space-y-1.5" data-testid="text-back-template">
        <Label htmlFor="text-back-template">Text</Label>
        <Textarea
          id="text-back-template"
          value={draft.textBackTemplate}
          onChange={(event) => setDraft({ ...draft, textBackTemplate: event.target.value })}
          maxLength={640}
          className="min-h-24 rounded-xl"
        />
      </div>
      <Toggle
        id="text-back-ai"
        label="Also text after the AI receptionist handles the call"
        checked={draft.textBackOnAi}
        onCheckedChange={(textBackOnAi) => setDraft({ ...draft, textBackOnAi })}
      />
      <Toggle
        id="text-back-voicemail"
        label="Also text after voicemail"
        checked={draft.textBackOnVoicemail}
        onCheckedChange={(textBackOnVoicemail) => setDraft({ ...draft, textBackOnVoicemail })}
      />
      <div className="space-y-1.5">
        <Label htmlFor="dedupe">Don't text the same caller again for (minutes)</Label>
        <Input
          id="dedupe"
          type="number"
          min={5}
          max={1440}
          value={draft.textBackDedupeMinutes}
          onChange={(event) =>
            setDraft({ ...draft, textBackDedupeMinutes: Number(event.target.value) })
          }
          className="h-11 rounded-xl px-4"
        />
      </div>

      <div className="border-t border-border pt-4" data-testid="hours-editor">
        <h3 className="font-display text-sm font-semibold">Business hours</h3>
        <p className="mt-1 text-xs text-muted-foreground">
          Open hours follow this line's current answering. After hours, calls go to the AI
          receptionist or voicemail.
        </p>
        <div className="mt-3">
          <Toggle
            id="hours-enabled"
            label="Use business hours"
            checked={draft.businessHoursEnabled}
            onCheckedChange={(businessHoursEnabled) => setDraft({ ...draft, businessHoursEnabled })}
            testId="hours-enabled"
          />
        </div>
        <div className="mt-3 space-y-1.5">
          <Label>Timezone</Label>
          <Select
            value={draft.businessTimezone}
            onValueChange={(businessTimezone) => setDraft({ ...draft, businessTimezone })}
          >
            <SelectTrigger className="h-11 w-full rounded-xl px-4">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {zones.map((zone) => (
                <SelectItem key={zone} value={zone}>
                  {zone}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="mt-3 space-y-2">
          {DAY_KEYS.map((day) => {
            const window = draft.schedule[day][0];
            const open = Boolean(window);
            return (
              <div key={day} className="grid grid-cols-[7rem_1fr_1fr] items-center gap-2">
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={open}
                    onChange={(event) => {
                      const schedule = { ...draft.schedule, [day]: [...draft.schedule[day]] };
                      schedule[day] = event.target.checked
                        ? [window ?? { open: "08:00", close: "17:00" }]
                        : [];
                      setDraft({ ...draft, schedule });
                    }}
                  />
                  {DAY_LABEL[day].slice(0, 3)}
                </label>
                <Input
                  type="time"
                  value={window?.open ?? "08:00"}
                  disabled={!open}
                  aria-label={`${DAY_LABEL[day]} opens`}
                  onChange={(event) => {
                    const schedule = { ...draft.schedule };
                    schedule[day] = [{ open: event.target.value, close: window?.close ?? "17:00" }];
                    setDraft({ ...draft, schedule });
                  }}
                  className="h-10 rounded-xl px-2"
                />
                <Input
                  type="time"
                  value={window?.close ?? "17:00"}
                  disabled={!open}
                  aria-label={`${DAY_LABEL[day]} closes`}
                  onChange={(event) => {
                    const schedule = { ...draft.schedule };
                    schedule[day] = [{ open: window?.open ?? "08:00", close: event.target.value }];
                    setDraft({ ...draft, schedule });
                  }}
                  className="h-10 rounded-xl px-2"
                />
              </div>
            );
          })}
        </div>
        <div className="mt-3 space-y-1.5">
          <Label htmlFor="holidays">Holiday dates (YYYY-MM-DD, one per line)</Label>
          <Textarea
            id="holidays"
            value={draft.holidays}
            onChange={(event) => setDraft({ ...draft, holidays: event.target.value })}
            placeholder="2026-12-25"
            className="min-h-16 rounded-xl"
          />
        </div>
        <div className="mt-3 space-y-1.5">
          <Label>After hours, send the call to</Label>
          <Select
            value={draft.afterHours}
            onValueChange={(value) =>
              setDraft({ ...draft, afterHours: value === "voicemail" ? "voicemail" : "ai" })
            }
          >
            <SelectTrigger className="h-11 w-full rounded-xl px-4" data-testid="after-hours">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ai">AI receptionist</SelectItem>
              <SelectItem value="voicemail">Voicemail</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="border-t border-border pt-4" data-testid="emergency-keywords">
        <h3 className="font-display text-sm font-semibold">Emergency keywords</h3>
        <p className="mt-1 text-xs text-muted-foreground">
          When the AI receptionist hears one of these, it warm-transfers the caller to the owner's
          cell.
        </p>
        <div className="mt-3 space-y-1.5">
          <Label htmlFor="keywords">Phrases, one per line</Label>
          <Textarea
            id="keywords"
            value={draft.emergencyKeywords}
            onChange={(event) => setDraft({ ...draft, emergencyKeywords: event.target.value })}
            className="min-h-24 rounded-xl"
          />
        </div>
        <div className="mt-3 space-y-1.5">
          <Label htmlFor="transfer">Owner's cell</Label>
          <Input
            id="transfer"
            value={draft.emergencyTransferNumber}
            onChange={(event) =>
              setDraft({ ...draft, emergencyTransferNumber: event.target.value })
            }
            inputMode="tel"
            placeholder="+1…"
            className="h-11 rounded-xl px-4"
          />
        </div>
      </div>

      <Button
        type="button"
        className="h-11 w-full rounded-xl"
        onClick={() => void save()}
        disabled={busy}
        data-testid="save-line-automation"
      >
        Save text-back, hours, and emergencies
      </Button>
    </div>
  );
}

function Toggle({
  id,
  label,
  checked,
  onCheckedChange,
  testId,
}: {
  id: string;
  label: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  testId?: string;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <Label htmlFor={id} className="text-sm font-normal">
        {label}
      </Label>
      <Switch id={id} checked={checked} onCheckedChange={onCheckedChange} data-testid={testId} />
    </div>
  );
}
