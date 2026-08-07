import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Loader2, Mail, ShieldCheck, Unplug } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { errorMessage, relativeTime } from "@/lib/format";
import {
  disconnectGmail,
  getGmailConnection,
  startGmailConnect,
} from "@/lib/gmail-connect.functions";

const CONNECTOR_ID = "google_mail";

function waitForOAuthCompletion(popup: Window) {
  return new Promise<void>((resolve, reject) => {
    let poll: number | undefined;
    const cleanup = () => {
      window.removeEventListener("message", onMessage);
      if (poll !== undefined) window.clearInterval(poll);
    };
    const onMessage = (event: MessageEvent) => {
      const type = event.data?.type;
      if (
        event.origin !== window.location.origin ||
        event.source !== popup ||
        event.data?.connectorId !== CONNECTOR_ID ||
        (type !== "appUserConnectorOAuthComplete" && type !== "appUserConnectorOAuthFailed")
      )
        return;
      cleanup();
      if (type === "appUserConnectorOAuthComplete") {
        resolve();
        return;
      }
      popup.close();
      reject(new Error("Google connection failed."));
    };
    window.addEventListener("message", onMessage);
    poll = window.setInterval(() => {
      if (!popup.closed) return;
      cleanup();
      reject(new Error("Google window closed before finishing."));
    }, 500);
  });
}

export function GmailConnect({ compact = false }: { compact?: boolean }) {
  const queryClient = useQueryClient();
  const connection = useQuery({
    queryKey: ["gmail-connection"],
    queryFn: () => getGmailConnection(),
  });

  const connect = useMutation({
    mutationFn: async () => {
      const popup = window.open("", "signalbox-google-oauth", "width=520,height=720");
      if (!popup) throw new Error("Popup blocked. Allow popups and try again.");
      try {
        const { authorizationUrl } = await startGmailConnect();
        const completion = waitForOAuthCompletion(popup);
        popup.location.href = authorizationUrl;
        await completion;
      } catch (error) {
        popup.close();
        throw error;
      }
    },
    onSuccess: async () => {
      toast.success("Gmail connected");
      await queryClient.invalidateQueries({ queryKey: ["gmail-connection"] });
      await queryClient.invalidateQueries({ queryKey: ["gmail"] });
      await queryClient.invalidateQueries({ queryKey: ["integration-status"] });
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  const unlink = useMutation({
    mutationFn: () => disconnectGmail(),
    onSuccess: async () => {
      toast.success("Gmail disconnected");
      await queryClient.invalidateQueries({ queryKey: ["gmail-connection"] });
      await queryClient.invalidateQueries({ queryKey: ["gmail"] });
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  const data = connection.data;

  if (data?.connected && compact) {
    return (
      <div className="glass-panel flex items-center justify-between gap-2 rounded-2xl px-3 py-2">
        <p className="truncate text-xs text-muted-foreground">
          <Check className="mr-1 inline size-3 text-primary" />
          {data.accountEmail ?? "Google account connected"}
        </p>
        <Button
          size="sm"
          variant="ghost"
          className="rounded-full"
          disabled={unlink.isPending}
          onClick={() => unlink.mutate()}
        >
          <Unplug className="size-3.5" />
        </Button>
      </div>
    );
  }

  return (
    <div className="glass-panel space-y-4 rounded-3xl p-5">
      <div className="flex items-start gap-3">
        <span className="grid size-10 place-items-center rounded-2xl bg-primary/15 text-primary">
          <Mail className="size-5" />
        </span>
        <div className="min-w-0">
          <p className="text-sm font-semibold">
            {data?.connected ? "Gmail connected" : "Connect your Gmail"}
          </p>
          <p className="text-xs text-muted-foreground">
            {data?.connected
              ? `${data.accountEmail ?? "Google account"}${
                  data.connectedAt ? ` · linked ${relativeTime(data.connectedAt)}` : ""
                }`
              : "Signalbox reads notification threads and sends replies as you — nothing else."}
          </p>
        </div>
      </div>

      <div className="space-y-2 rounded-2xl border border-white/5 bg-white/[0.02] p-3">
        <p className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          <ShieldCheck className="size-3.5" /> Permissions requested
        </p>
        {(data?.scopes ?? []).map((s) => (
          <p key={s.scope} className="flex items-start gap-2 text-xs text-muted-foreground">
            <Check className="mt-0.5 size-3 shrink-0 text-primary" />
            <span>
              {s.label} <span className="opacity-50">({s.scope})</span>
            </span>
          </p>
        ))}
      </div>

      <div className="flex gap-2">
        <Button
          className="flex-1 rounded-full"
          disabled={connect.isPending}
          onClick={() => connect.mutate()}
        >
          {connect.isPending ? (
            <Loader2 className="size-4 animate-spin" />
          ) : data?.connected ? (
            "Reconnect / update scopes"
          ) : (
            "Connect Google account"
          )}
        </Button>
        {data?.connected && (
          <Button
            variant="secondary"
            className="rounded-full"
            disabled={unlink.isPending}
            onClick={() => unlink.mutate()}
          >
            {unlink.isPending ? <Loader2 className="size-4 animate-spin" /> : "Disconnect"}
          </Button>
        )}
      </div>
    </div>
  );
}