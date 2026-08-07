import { useQuery } from "@tanstack/react-query";

import { relativeTime } from "@/lib/format";
import { getIntegrationStatus } from "@/lib/integrations.functions";

export function EmailLogPanel() {
  const status = useQuery({
    queryKey: ["integration-status"],
    queryFn: () => getIntegrationStatus(),
  });
  const email = status.data?.email;

  return (
    <div className="space-y-3">
      <div className="glass-panel rounded-2xl p-4 text-sm">
        <p className="font-medium">Resend · {email?.domain ?? "bookme.bet"}</p>
        <p className="text-xs text-muted-foreground">
          {email
            ? email.verified
              ? "Domain verified — outbound alerts are live."
              : `Domain status: ${email.domainStatus}`
            : "Checking connection…"}
        </p>
      </div>

      {(email?.recent ?? []).map((row) => (
        <div key={row.id} className="glass-panel rounded-2xl p-3">
          <div className="flex items-center justify-between gap-2">
            <span className="truncate text-sm font-medium">{row.subject}</span>
            <span className="shrink-0 text-[11px] text-muted-foreground">
              {relativeTime(row.created_at)}
            </span>
          </div>
          <p className="truncate text-xs text-muted-foreground">
            {row.to_address} · {row.template} · {row.status}
          </p>
          {row.error && <p className="text-xs text-destructive">{row.error}</p>}
        </div>
      ))}
      {email && email.recent.length === 0 && (
        <p className="px-1 text-sm text-muted-foreground">No emails sent yet.</p>
      )}
    </div>
  );
}