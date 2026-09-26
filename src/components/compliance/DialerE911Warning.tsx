import { AlertTriangle } from "lucide-react";

/** Persistent dialer warning until the user acknowledges 47 CFR 9.11. */
export function DialerE911Warning({ acknowledged }: { acknowledged: boolean }) {
  if (acknowledged) return null;
  return (
    <div
      role="status"
      className="flex items-start gap-2 rounded-xl border border-warning/40 bg-warning/10 px-3 py-2 text-left text-xs text-warning"
    >
      <AlertTriangle className="mt-0.5 size-4 shrink-0" />
      <p>
        911 from this line is VoIP. Acknowledge the service limitations before you place a call.
        Without a registered address, a 911 call is routed to a national center at $75.
      </p>
    </div>
  );
}
