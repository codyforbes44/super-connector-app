import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CalendarCog, Loader2, Save } from "lucide-react";
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
import { errorMessage } from "@/lib/format";
import { listCalendars } from "@/lib/integrations.functions";
import { getCalendarSyncSettings, saveCalendarSyncSettings } from "@/lib/tools.functions";

type Settings = {
  activeCalendars: string[];
  defaultCalendarId: string;
  timezone: string;
  lookbackDays: number;
  lookaheadDays: number;
  eventTitleTemplate: string;
  defaultDurationMinutes: number;
  bufferMinutes: number;
  inviteContact: boolean;
  addMeetLink: boolean;
  aiEventStatus: string;
};

const DEFAULTS: Settings = {
  activeCalendars: ["primary"],
  defaultCalendarId: "primary",
  timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
  lookbackDays: 7,
  lookaheadDays: 30,
  eventTitleTemplate: "Call with {{contact}}",
  defaultDurationMinutes: 30,
  bufferMinutes: 10,
  inviteContact: true,
  addMeetLink: false,
  aiEventStatus: "confirmed",
};

export function CalendarSettingsPanel() {
  const queryClient = useQueryClient();
  const [form, setForm] = useState<Settings>(DEFAULTS);

  const calendars = useQuery({ queryKey: ["calendars"], queryFn: () => listCalendars() });
  const saved = useQuery({
    queryKey: ["calendar-settings"],
    queryFn: () => getCalendarSyncSettings(),
  });

  useEffect(() => {
    const row = saved.data as Record<string, unknown> | null | undefined;
    if (!row) return;
    setForm({
      activeCalendars: (row["active_calendars"] as string[]) ?? DEFAULTS.activeCalendars,
      defaultCalendarId: (row["default_calendar_id"] as string) ?? DEFAULTS.defaultCalendarId,
      timezone: (row["timezone"] as string) ?? DEFAULTS.timezone,
      lookbackDays: (row["lookback_days"] as number) ?? DEFAULTS.lookbackDays,
      lookaheadDays: (row["lookahead_days"] as number) ?? DEFAULTS.lookaheadDays,
      eventTitleTemplate:
        (row["event_title_template"] as string) ?? DEFAULTS.eventTitleTemplate,
      defaultDurationMinutes:
        (row["default_duration_minutes"] as number) ?? DEFAULTS.defaultDurationMinutes,
      bufferMinutes: (row["buffer_minutes"] as number) ?? DEFAULTS.bufferMinutes,
      inviteContact: (row["invite_contact"] as boolean) ?? DEFAULTS.inviteContact,
      addMeetLink: (row["add_meet_link"] as boolean) ?? DEFAULTS.addMeetLink,
      aiEventStatus: (row["ai_event_status"] as string) ?? DEFAULTS.aiEventStatus,
    });
  }, [saved.data]);

  const save = useMutation({
    mutationFn: () => saveCalendarSyncSettings({ data: form }),
    onSuccess: async () => {
      toast.success("Calendar sync settings saved");
      await queryClient.invalidateQueries({ queryKey: ["calendar-settings"] });
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  const list = (calendars.data ?? []) as Array<{ id: string; summary: string }>;

  const toggleCalendar = (id: string) => {
    setForm((f) => ({
      ...f,
      activeCalendars: f.activeCalendars.includes(id)
        ? f.activeCalendars.filter((c) => c !== id)
        : [...f.activeCalendars, id],
    }));
  };

  return (
    <div className="space-y-4">
      <div className="glass-panel space-y-3 rounded-3xl p-4">
        <p className="flex items-center gap-2 text-sm font-medium">
          <CalendarCog className="size-4" /> Calendars in use
        </p>
        {list.length === 0 && (
          <p className="text-xs text-muted-foreground">No calendars available yet.</p>
        )}
        {list.map((c) => (
          <div key={c.id} className="flex items-center justify-between gap-3">
            <span className="truncate text-sm">{c.summary}</span>
            <Switch
              checked={form.activeCalendars.includes(c.id)}
              onCheckedChange={() => toggleCalendar(c.id)}
            />
          </div>
        ))}
      </div>

      <div className="glass-panel space-y-3 rounded-3xl p-4">
        <div className="space-y-1">
          <Label>Default calendar for new bookings</Label>
          <Select
            value={form.defaultCalendarId}
            onValueChange={(v) => setForm({ ...form, defaultCalendarId: v })}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="primary">Primary</SelectItem>
              {list.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.summary}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label>Timezone</Label>
          <Input
            value={form.timezone}
            onChange={(e) => setForm({ ...form, timezone: e.target.value })}
          />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1">
            <Label>Lookback (days)</Label>
            <Input
              type="number"
              value={form.lookbackDays}
              onChange={(e) => setForm({ ...form, lookbackDays: Number(e.target.value) })}
            />
          </div>
          <div className="space-y-1">
            <Label>Lookahead (days)</Label>
            <Input
              type="number"
              value={form.lookaheadDays}
              onChange={(e) => setForm({ ...form, lookaheadDays: Number(e.target.value) })}
            />
          </div>
        </div>
      </div>

      <div className="glass-panel space-y-3 rounded-3xl p-4">
        <p className="text-sm font-medium">Event creation</p>
        <div className="space-y-1">
          <Label>Event title template</Label>
          <Input
            value={form.eventTitleTemplate}
            onChange={(e) => setForm({ ...form, eventTitleTemplate: e.target.value })}
            placeholder="Call with {{contact}}"
          />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1">
            <Label>Duration (min)</Label>
            <Input
              type="number"
              value={form.defaultDurationMinutes}
              onChange={(e) =>
                setForm({ ...form, defaultDurationMinutes: Number(e.target.value) })
              }
            />
          </div>
          <div className="space-y-1">
            <Label>Buffer (min)</Label>
            <Input
              type="number"
              value={form.bufferMinutes}
              onChange={(e) => setForm({ ...form, bufferMinutes: Number(e.target.value) })}
            />
          </div>
        </div>
        <div className="flex items-center justify-between">
          <Label className="text-sm">Invite the contact by email</Label>
          <Switch
            checked={form.inviteContact}
            onCheckedChange={(v) => setForm({ ...form, inviteContact: v })}
          />
        </div>
        <div className="flex items-center justify-between">
          <Label className="text-sm">Add a Google Meet link</Label>
          <Switch
            checked={form.addMeetLink}
            onCheckedChange={(v) => setForm({ ...form, addMeetLink: v })}
          />
        </div>
        <div className="space-y-1">
          <Label>AI-booked events are</Label>
          <Select
            value={form.aiEventStatus}
            onValueChange={(v) => setForm({ ...form, aiEventStatus: v })}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="confirmed">Confirmed</SelectItem>
              <SelectItem value="tentative">Tentative (needs review)</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <Button className="w-full rounded-full" disabled={save.isPending} onClick={() => save.mutate()}>
        {save.isPending ? (
          <Loader2 className="size-4 animate-spin" />
        ) : (
          <>
            <Save className="size-4" /> Save calendar settings
          </>
        )}
      </Button>
    </div>
  );
}