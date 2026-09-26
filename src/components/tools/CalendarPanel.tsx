import { useMutation, useQuery } from "@tanstack/react-query";
import { CalendarPlus, Clock, Loader2 } from "lucide-react";
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
import { errorMessage } from "@/lib/format";
import {
  createBooking,
  listCalendars,
  listOpenSlots,
  listUpcomingEvents,
} from "@/lib/integrations.functions";
import { supabase } from "@/integrations/supabase/client";

const fmt = (iso: string) =>
  iso
    ? new Date(iso).toLocaleString(undefined, {
        weekday: "short",
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
      })
    : "";

export function CalendarPanel() {
  const [calendarId, setCalendarId] = useState("primary");
  const [appNumber, setAppNumber] = useState("");
  const [summary, setSummary] = useState("Call back");
  const [attendee, setAttendee] = useState("");

  const calendars = useQuery({ queryKey: ["calendars"], queryFn: () => listCalendars() });

  const numbers = useQuery({
    queryKey: ["numbers-lite"],
    queryFn: async () => {
      const { data } = await supabase.from("phone_numbers").select("phone_number").limit(50);
      return data ?? [];
    },
  });

  const events = useQuery({
    queryKey: ["cal-events", calendarId],
    queryFn: () => listUpcomingEvents({ data: { calendarId, max: 10 } }),
  });

  const slots = useQuery({
    queryKey: ["cal-slots", appNumber],
    queryFn: () => listOpenSlots({ data: { appNumber } }),
    enabled: Boolean(appNumber),
  });

  const book = useMutation({
    mutationFn: (slot: { start: string; end: string }) =>
      createBooking({
        data: {
          appNumber,
          start: slot.start,
          end: slot.end,
          summary,
          ...(attendee ? { contactEmail: attendee } : {}),
        },
      }),
    onSuccess: () => {
      toast.success("Booking created");
      void events.refetch();
      void slots.refetch();
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  if (calendars.data && calendars.data.length === 0) {
    return (
      <p className="glass-panel rounded-2xl p-4 text-sm text-muted-foreground">
        Google Calendar isn’t connected yet.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <div className="glass-panel space-y-3 rounded-2xl p-4">
        <Label>Calendar</Label>
        <Select value={calendarId} onValueChange={setCalendarId}>
          <SelectTrigger>
            <SelectValue placeholder="Primary" />
          </SelectTrigger>
          <SelectContent>
            {(calendars.data ?? []).map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {c.summary}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <p className="px-1 text-xs uppercase tracking-wide text-muted-foreground">Upcoming</p>
        {events.isLoading && <Loader2 className="size-4 animate-spin" />}
        {(events.data?.events ?? []).map((e) => (
          <div key={e.id} className="glass-panel rounded-2xl p-3">
            <p className="text-sm font-medium">{e.summary}</p>
            <p className="text-xs text-muted-foreground">
              {fmt(e.start)} → {fmt(e.end)}
            </p>
            {e.attendees.length > 0 && (
              <p className="truncate text-xs text-muted-foreground">{e.attendees.join(", ")}</p>
            )}
          </div>
        ))}
        {events.data && events.data.events.length === 0 && (
          <p className="px-1 text-sm text-muted-foreground">Nothing scheduled.</p>
        )}
      </div>

      <div className="glass-panel space-y-3 rounded-2xl p-4">
        <p className="flex items-center gap-2 text-sm font-medium">
          <CalendarPlus className="size-4" /> Book a slot
        </p>
        <div className="space-y-1">
          <Label>SixVox number</Label>
          <Select value={appNumber} onValueChange={setAppNumber}>
            <SelectTrigger>
              <SelectValue placeholder="Choose a number" />
            </SelectTrigger>
            <SelectContent>
              {(numbers.data ?? []).map((n) => (
                <SelectItem key={n.phone_number as string} value={n.phone_number as string}>
                  {n.phone_number as string}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label>Title</Label>
          <Input value={summary} onChange={(e) => setSummary(e.target.value)} />
        </div>
        <div className="space-y-1">
          <Label>Attendee email (optional)</Label>
          <Input value={attendee} onChange={(e) => setAttendee(e.target.value)} />
        </div>

        {slots.isFetching && <Loader2 className="size-4 animate-spin" />}
        <div className="grid grid-cols-2 gap-2">
          {(slots.data?.slots ?? []).map((s) => (
            <Button
              key={s.start}
              variant="secondary"
              className="justify-start rounded-xl text-xs"
              disabled={book.isPending}
              onClick={() => book.mutate(s)}
            >
              <Clock className="size-3.5" /> {fmt(s.start)}
            </Button>
          ))}
        </div>
        {appNumber && slots.data && slots.data.slots.length === 0 && (
          <p className="text-sm text-muted-foreground">No open slots in the next 7 days.</p>
        )}
      </div>
    </div>
  );
}
