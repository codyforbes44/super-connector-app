import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  CheckCheck,
  Eye,
  Loader2,
  MousePointerClick,
  RefreshCw,
  Send,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { errorMessage, relativeTime } from "@/lib/format";
import { getIntegrationStatus } from "@/lib/integrations.functions";
import { getEmailDetail, listEmailDeliveries, retryEmailDelivery } from "@/lib/tools.functions";

const STATUSES = ["all", "sent", "delivered", "bounced", "complained", "failed", "skipped"];

function StatusChip({ label, value }: { label: string; value: number }) {
  return (
    <div className="glass-panel flex-1 rounded-2xl px-3 py-2 text-center">
      <p className="text-lg font-semibold">{value}</p>
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p>
    </div>
  );
}

export function EmailLogPanel() {
  const queryClient = useQueryClient();
  const [status, setStatus] = useState("all");
  const [recipient, setRecipient] = useState("");
  const [detailId, setDetailId] = useState<string | null>(null);

  const integration = useQuery({
    queryKey: ["integration-status"],
    queryFn: () => getIntegrationStatus(),
  });
  const email = integration.data?.email;

  const deliveries = useQuery({
    queryKey: ["email-deliveries", status, recipient],
    queryFn: () =>
      listEmailDeliveries({ data: { status, recipient: recipient.trim(), limit: 50 } }),
  });

  const detail = useQuery({
    queryKey: ["email-detail", detailId],
    queryFn: () => getEmailDetail({ data: { id: detailId as string } }),
    enabled: Boolean(detailId),
  });

  const retry = useMutation({
    mutationFn: (id: string) => retryEmailDelivery({ data: { id } }),
    onSuccess: async () => {
      toast.success("Email re-sent");
      setDetailId(null);
      await queryClient.invalidateQueries({ queryKey: ["email-deliveries"] });
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  const stats = deliveries.data?.stats;
  const detailRow = detail.data as Record<string, unknown> | null | undefined;

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

      {stats && (
        <div className="flex gap-2">
          <StatusChip label="Sent" value={stats.sent} />
          <StatusChip label="Delivered" value={stats.delivered} />
          <StatusChip label="Opened" value={stats.opened} />
          <StatusChip label="Clicked" value={stats.clicked} />
          <StatusChip label="Failed" value={stats.failed} />
        </div>
      )}

      <div className="flex gap-2">
        <Input
          value={recipient}
          onChange={(e) => setRecipient(e.target.value)}
          placeholder="Filter by recipient"
        />
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="w-36">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {STATUSES.map((s) => (
              <SelectItem key={s} value={s}>
                {s}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {deliveries.isLoading && <Loader2 className="mx-auto size-4 animate-spin" />}

      {(deliveries.data?.rows ?? []).map((row) => (
        <button
          key={row.id}
          type="button"
          onClick={() => setDetailId(row.id)}
          className="glass-panel w-full rounded-2xl p-3 text-left"
        >
          <div className="flex items-center justify-between gap-2">
            <span className="truncate text-sm font-medium">{row.subject}</span>
            <span className="shrink-0 text-[11px] text-muted-foreground">
              {relativeTime(row.created_at)}
            </span>
          </div>
          <p className="truncate text-xs text-muted-foreground">
            {row.to_address} · {row.template} · {row.status}
          </p>
          <div className="mt-1 flex items-center gap-3 text-[11px] text-muted-foreground">
            {row.delivered_at && (
              <span className="flex items-center gap-1 text-primary">
                <CheckCheck className="size-3" /> delivered
              </span>
            )}
            {row.opened_at && (
              <span className="flex items-center gap-1">
                <Eye className="size-3" /> {row.open_count || 1}
              </span>
            )}
            {row.clicked_at && (
              <span className="flex items-center gap-1">
                <MousePointerClick className="size-3" /> {row.click_count || 1}
              </span>
            )}
            {(row.bounced_at || row.status === "failed") && (
              <span className="flex items-center gap-1 text-destructive">
                <AlertTriangle className="size-3" /> failed
              </span>
            )}
            {row.retry_of && <span>retry</span>}
          </div>
        </button>
      ))}
      {deliveries.data && deliveries.data.rows.length === 0 && (
        <p className="px-1 text-sm text-muted-foreground">No emails match this filter.</p>
      )}

      <Sheet open={Boolean(detailId)} onOpenChange={(open) => !open && setDetailId(null)}>
        <SheetContent side="bottom" className="max-h-[85dvh] overflow-y-auto">
          <SheetHeader>
            <SheetTitle className="truncate">
              {(detailRow?.["subject"] as string) ?? "Email"}
            </SheetTitle>
          </SheetHeader>
          {detail.isLoading && <Loader2 className="size-4 animate-spin" />}
          {detailRow && (
            <div className="space-y-3 pb-6 text-sm">
              <div className="glass-panel space-y-1 rounded-2xl p-3 text-xs text-muted-foreground">
                <p>To: {detailRow["to_address"] as string}</p>
                <p>Template: {detailRow["template"] as string}</p>
                <p>Status: {detailRow["status"] as string}</p>
                <p>Provider ID: {(detailRow["provider_id"] as string) ?? "—"}</p>
                {(detailRow["delivered_at"] as string) && (
                  <p>Delivered: {relativeTime(detailRow["delivered_at"] as string)}</p>
                )}
                {(detailRow["opened_at"] as string) && (
                  <p>
                    Opened: {relativeTime(detailRow["opened_at"] as string)} ·{" "}
                    {(detailRow["open_count"] as number) ?? 0}x
                  </p>
                )}
                {(detailRow["clicked_at"] as string) && (
                  <p>
                    Clicked: {relativeTime(detailRow["clicked_at"] as string)} ·{" "}
                    {(detailRow["click_count"] as number) ?? 0}x
                  </p>
                )}
              </div>
              {(detailRow["error"] as string) && (
                <p className="rounded-2xl bg-destructive/10 p-3 text-xs text-destructive">
                  {detailRow["error"] as string}
                </p>
              )}
              <Button
                className="w-full rounded-full"
                disabled={retry.isPending}
                onClick={() => retry.mutate(detailRow["id"] as string)}
              >
                {retry.isPending ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <>
                    <RefreshCw className="size-4" /> Resend this email
                  </>
                )}
              </Button>
              {(detailRow["body_html"] as string) && (
                <iframe
                  title="Email preview"
                  className="h-[420px] w-full rounded-2xl border border-border bg-white"
                  srcDoc={detailRow["body_html"] as string}
                />
              )}
              <p className="flex items-center gap-1 text-[11px] text-muted-foreground">
                <Send className="size-3" /> Open and click tracking requires the Resend webhook.
              </p>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
