import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
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
import { getBookingSettings, saveBookingSettings } from "@/lib/integrations.functions";
import { campaignApproved } from "@/lib/message-status";

const DAYS = [
  [1, "Mon"],
  [2, "Tue"],
  [3, "Wed"],
  [4, "Thu"],
  [5, "Fri"],
  [6, "Sat"],
  [0, "Sun"],
] as const;

export type BookingPreview = {
  enabled: boolean;
  confirmMode: "confirm" | "automatic";
  slotMinutes: number;
  bufferMinutes: number;
  travelMinutes: number;
  timezone: string;
  hours: { start: string; end: string; days: number[] };
  serviceAreaMode: "off" | "radius" | "zips";
  serviceAreaRadiusMiles: number | null;
  serviceAreaAddress: string;
  serviceAreaZips: string;
  textingRegistered: boolean;
};

export function BookingSettings({ sid, preview }: { sid?: string; preview?: BookingPreview }) {
  const queryClient = useQueryClient();
  const settings = useQuery({
    queryKey: ["booking-settings", sid],
    queryFn: () => getBookingSettings({ data: { sid: sid! } }),
    enabled: Boolean(sid) && !preview,
  });
  const row = (preview ? null : settings.data) as Record<string, unknown> | null | undefined;
  const textingRegistered = preview
    ? preview.textingRegistered
    : Boolean(row?.["messaging_service_sid"]) &&
      campaignApproved((row?.["campaign_status"] as string | null) ?? null);

  const [enabled, setEnabled] = useState(preview?.enabled ?? false);
  const [confirmMode, setConfirmMode] = useState<"confirm" | "automatic">(
    preview?.confirmMode ?? "confirm",
  );
  const [slotMinutes, setSlotMinutes] = useState(String(preview?.slotMinutes ?? 60));
  const [bufferMinutes, setBufferMinutes] = useState(String(preview?.bufferMinutes ?? 15));
  const [travelMinutes, setTravelMinutes] = useState(String(preview?.travelMinutes ?? 20));
  const [timezone, setTimezone] = useState(preview?.timezone ?? "America/Chicago");
  const [start, setStart] = useState(preview?.hours.start ?? "08:00");
  const [end, setEnd] = useState(preview?.hours.end ?? "17:00");
  const [days, setDays] = useState<number[]>(preview?.hours.days ?? [1, 2, 3, 4, 5]);
  const [areaMode, setAreaMode] = useState<"off" | "radius" | "zips">(
    preview?.serviceAreaMode ?? "radius",
  );
  const [radius, setRadius] = useState(String(preview?.serviceAreaRadiusMiles ?? 25));
  const [address, setAddress] = useState(preview?.serviceAreaAddress ?? "");
  const [zips, setZips] = useState(preview?.serviceAreaZips ?? "");
  const [hydrated, setHydrated] = useState(Boolean(preview));

  if (row && !hydrated) {
    setEnabled(Boolean(row["booking_enabled"]));
    setConfirmMode(row["booking_confirm_mode"] === "automatic" ? "automatic" : "confirm");
    setSlotMinutes(String(row["booking_slot_minutes"] ?? 60));
    setBufferMinutes(String(row["booking_buffer_minutes"] ?? 0));
    setTravelMinutes(String(row["booking_travel_minutes"] ?? 0));
    setTimezone(String(row["booking_timezone"] ?? "America/Chicago"));
    const hours =
      (row["booking_hours"] as { start?: string; end?: string; days?: number[] } | null) ?? {};
    setStart(hours.start ?? "09:00");
    setEnd(hours.end ?? "17:00");
    setDays(hours.days ?? [1, 2, 3, 4, 5]);
    const mode = row["service_area_mode"];
    setAreaMode(mode === "radius" || mode === "zips" ? mode : "off");
    setRadius(String(row["service_area_radius_miles"] ?? 25));
    setAddress(String(row["service_area_address"] ?? ""));
    setZips(((row["service_area_zips"] as string[] | null) ?? []).join(", "));
    setHydrated(true);
  }

  const save = useMutation({
    mutationFn: () =>
      saveBookingSettings({
        data: {
          sid: sid!,
          calendarId: (row?.["calendar_id"] as string | null) ?? "primary",
          enabled,
          slotMinutes: Number(slotMinutes) || 30,
          bufferMinutes: Number(bufferMinutes) || 0,
          timezone,
          hours: { start, end, days },
          travelMinutes: Number(travelMinutes) || 0,
          confirmMode,
          serviceAreaMode: areaMode,
          serviceAreaRadiusMiles: areaMode === "radius" ? Number(radius) || null : null,
          serviceAreaAddress: address || null,
          serviceAreaZips: zips
            .split(/[\s,]+/)
            .map((zip) => zip.trim())
            .filter((zip) => /^\d{5}$/.test(zip)),
        },
      }),
    onSuccess: async () => {
      toast.success("Booking settings saved.");
      await queryClient.invalidateQueries({ queryKey: ["booking-settings", sid] });
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  return (
    <section className="glass-panel space-y-3 rounded-3xl p-4" aria-label="Booking settings">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="font-display text-sm font-semibold">AI booking</p>
          <p className="text-xs text-muted-foreground">
            Real calendar availability, travel time, and service area.
          </p>
        </div>
        <Switch checked={enabled} onCheckedChange={setEnabled} aria-label="Booking enabled" />
      </div>

      <div className="space-y-1.5">
        <Label>When a slot is chosen</Label>
        <Select
          value={confirmMode}
          onValueChange={(value) => setConfirmMode(value as "confirm" | "automatic")}
        >
          <SelectTrigger className="h-11 rounded-xl">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="confirm">You approve with one tap</SelectItem>
            <SelectItem value="automatic">Book automatically</SelectItem>
          </SelectContent>
        </Select>
        <p className="text-xs text-muted-foreground">
          Automatic booking is optional. The default waits for your approval before the customer is
          texted.
        </p>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <Field label="Slot" value={slotMinutes} onChange={setSlotMinutes} />
        <Field label="Buffer" value={bufferMinutes} onChange={setBufferMinutes} />
        <Field label="Travel" value={travelMinutes} onChange={setTravelMinutes} />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1.5">
          <Label>Opens</Label>
          <Input
            value={start}
            onChange={(event) => setStart(event.target.value)}
            className="h-11 rounded-xl"
          />
        </div>
        <div className="space-y-1.5">
          <Label>Closes</Label>
          <Input
            value={end}
            onChange={(event) => setEnd(event.target.value)}
            className="h-11 rounded-xl"
          />
        </div>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {DAYS.map(([value, label]) => (
          <button
            key={value}
            type="button"
            onClick={() =>
              setDays((current) =>
                current.includes(value)
                  ? current.filter((day) => day !== value)
                  : [...current, value],
              )
            }
            className={`rounded-full px-3 py-1 text-xs ${days.includes(value) ? "key-raised" : "bg-muted/40 text-muted-foreground"}`}
          >
            {label}
          </button>
        ))}
      </div>
      <div className="space-y-1.5">
        <Label>Timezone</Label>
        <Input
          value={timezone}
          onChange={(event) => setTimezone(event.target.value)}
          className="h-11 rounded-xl"
        />
      </div>
      <div className="space-y-1.5">
        <Label>Service area</Label>
        <Select
          value={areaMode}
          onValueChange={(value) => setAreaMode(value as "off" | "radius" | "zips")}
        >
          <SelectTrigger className="h-11 rounded-xl">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="off">No area check</SelectItem>
            <SelectItem value="radius">Radius from an address</SelectItem>
            <SelectItem value="zips">ZIP list</SelectItem>
          </SelectContent>
        </Select>
      </div>
      {areaMode === "radius" ? (
        <div className="grid grid-cols-[1fr_5rem] gap-2">
          <div className="space-y-1.5">
            <Label>Center address</Label>
            <Input
              value={address}
              onChange={(event) => setAddress(event.target.value)}
              className="h-11 rounded-xl"
            />
          </div>
          <Field label="Miles" value={radius} onChange={setRadius} />
        </div>
      ) : null}
      {areaMode === "zips" ? (
        <div className="space-y-1.5">
          <Label>ZIP codes</Label>
          <Input
            value={zips}
            onChange={(event) => setZips(event.target.value)}
            placeholder="74103, 74104"
            className="h-11 rounded-xl"
          />
        </div>
      ) : null}
      <p className={`text-xs ${textingRegistered ? "text-muted-foreground" : "text-destructive"}`}>
        {textingRegistered
          ? "Confirmation texts use this line's Messaging Service."
          : "Not registered for texting. Bookings can still be approved, but confirmation texts stay off until this line is on an approved campaign."}
      </p>
      {sid ? (
        <Button
          className="h-11 w-full rounded-xl"
          disabled={save.isPending}
          onClick={() => save.mutate()}
        >
          Save booking
        </Button>
      ) : null}
    </section>
  );
}

function Field({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <Input
        value={value}
        onChange={(event) => onChange(event.target.value.replace(/[^\d:]/g, ""))}
        className="h-11 rounded-xl"
      />
    </div>
  );
}
