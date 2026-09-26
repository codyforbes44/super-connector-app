import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { errorMessage, formatPhone } from "@/lib/format";
import { approveBooking, declineBooking, listPendingBookings } from "@/lib/receptionist.functions";

export type PendingPreview = {
  id: string;
  contact_name: string | null;
  contact_number: string | null;
  address: string | null;
  job_type: string | null;
  summary: string | null;
  slot_start: string;
  slot_end: string;
  sms_status: string | null;
  status: string;
};

export function PendingBookings({ preview }: { preview?: PendingPreview[] }) {
  const queryClient = useQueryClient();
  const pending = useQuery({
    queryKey: ["pending-bookings"],
    queryFn: () => listPendingBookings(),
    enabled: !preview,
  });
  const rows = (preview ?? pending.data ?? []) as PendingPreview[];
  const decide = useMutation({
    mutationFn: async (input: { id: string; approve: boolean }) => {
      if (input.approve) return approveBooking({ data: { id: input.id } });
      await declineBooking({ data: { id: input.id } });
      return { ok: true, message: "Declined.", texting: "skipped" as const };
    },
    onSuccess: async (result) => {
      const texting = result && "texting" in result ? result.texting : null;
      toast.success(
        texting === "not_registered"
          ? "Booked. This line is not registered for texting, so no confirmation text was sent."
          : "Booking updated.",
      );
      await queryClient.invalidateQueries({ queryKey: ["pending-bookings"] });
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  if (!rows.length) return null;

  return (
    <section className="space-y-2 px-4 pt-4" aria-label="Approve booking">
      <h2 className="font-display text-sm font-semibold">Approve a booking</h2>
      {rows.map((row) => (
        <article key={row.id} className="glass-panel space-y-2 rounded-3xl p-4">
          <p className="text-sm font-semibold">{row.summary || row.job_type || "Job"}</p>
          <p className="text-xs text-muted-foreground">
            {row.contact_name || "Caller"}
            {row.contact_number ? ` · ${formatPhone(row.contact_number)}` : ""}
          </p>
          {row.address ? <p className="text-xs">{row.address}</p> : null}
          <p className="text-xs tabular">{new Date(row.slot_start).toLocaleString()}</p>
          {row.sms_status === "not_registered" || row.status === "reschedule_requested" ? (
            <p className="text-xs text-destructive">
              {row.status === "reschedule_requested"
                ? "The customer asked to reschedule."
                : "Not registered for texting."}
            </p>
          ) : (
            <p className="text-xs text-muted-foreground">
              One tap books the calendar, then the customer gets a confirmation text.
            </p>
          )}
          {preview ? (
            <div className="flex gap-2">
              <Button className="key-call h-11 flex-1 rounded-xl">Approve</Button>
              <Button variant="secondary" className="h-11 flex-1 rounded-xl">
                Decline
              </Button>
            </div>
          ) : (
            <div className="flex gap-2">
              <Button
                className="key-call h-11 flex-1 rounded-xl"
                disabled={decide.isPending}
                onClick={() => decide.mutate({ id: row.id, approve: true })}
              >
                Approve
              </Button>
              <Button
                variant="secondary"
                className="h-11 flex-1 rounded-xl"
                disabled={decide.isPending}
                onClick={() => decide.mutate({ id: row.id, approve: false })}
              >
                Decline
              </Button>
            </div>
          )}
        </article>
      ))}
    </section>
  );
}
