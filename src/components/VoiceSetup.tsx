import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, PhoneCall, RefreshCw, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { errorMessage } from "@/lib/format";
import {
  createTwimlApp,
  deleteTwimlApp,
  setDefaultTwimlApp,
  syncTwimlApp,
  voiceSetupStatus,
  listTwimlApps,
} from "@/lib/twilio.functions";

type AppRow = {
  sid: string;
  friendly_name: string;
  voice_url?: string | null;
  is_default?: boolean;
};

/** Admin controls for the TwiML App that powers in-app calling. */
export function VoiceSetup() {
  const queryClient = useQueryClient();
  const [name, setName] = useState("SixVox-TwiML-App");
  const [busy, setBusy] = useState(false);

  const status = useQuery({ queryKey: ["voice-setup"], queryFn: () => voiceSetupStatus() });
  const apps = useQuery({ queryKey: ["twiml-apps"], queryFn: () => listTwimlApps() });

  const info = status.data as unknown as
    | {
        hasApiKey: boolean;
        hasDefault?: boolean;
        voiceUrl: string;
        statusUrl: string;
        smsUrl: string;
      }
    | undefined;
  const rows = (apps.data ?? []) as unknown as AppRow[];

  async function run(action: () => Promise<unknown>, message: string) {
    setBusy(true);
    try {
      await action();
      toast.success(message);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["twiml-apps"] }),
        queryClient.invalidateQueries({ queryKey: ["voice-setup"] }),
      ]);
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="space-y-3 border-t border-border px-4 py-4">
      <div className="flex items-center gap-2">
        <PhoneCall className="h-4 w-4 text-primary" />
        <h2 className="font-display text-sm font-semibold">In-app calling (TwiML App)</h2>
      </div>
      <p className="text-xs text-muted-foreground">
        The default app routes calls to and from this device. Numbers wired to it ring in SixVox
        instead of forwarding to a phone.
      </p>

      {info && !info.hasApiKey ? (
        <p className="glass-panel rounded-3xl px-4 py-3 text-xs text-destructive">
          A voice API key is missing, so in-app calling tokens can't be minted.
        </p>
      ) : null}

      {info && info.hasApiKey && info.hasDefault === false && rows.length > 0 ? (
        <p className="glass-panel rounded-3xl px-4 py-3 text-xs text-destructive">
          No default app is selected, so this device can't register for calls. Tap “Use this” on the
          app you want SixVox to call through.
        </p>
      ) : null}

      <div className="flex gap-2">
        <Input
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="App name"
          className="h-10 rounded-xl px-4"
        />
        <Button
          className="rounded-full"
          disabled={busy || !name.trim()}
          onClick={() =>
            run(() => createTwimlApp({ data: { name: name.trim() } }), "TwiML App created.")
          }
        >
          Create
        </Button>
      </div>

      <ul className="space-y-2">
        {rows.map((app) => (
          <li key={app.sid} className="glass-panel space-y-2 rounded-3xl px-4 py-3">
            <div className="flex items-center gap-2">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">{app.friendly_name}</p>
                <p className="tabular truncate text-[0.7rem] text-muted-foreground">{app.sid}</p>
              </div>
              {app.is_default ? (
                <span className="key-signal rounded-full px-3 py-1 text-[0.65rem] font-semibold">
                  Default
                </span>
              ) : null}
            </div>
            <div className="flex flex-wrap gap-2">
              {app.is_default ? null : (
                <Button
                  size="sm"
                  variant="secondary"
                  className="rounded-full"
                  disabled={busy}
                  onClick={() =>
                    run(() => setDefaultTwimlApp({ data: { sid: app.sid } }), "Default app set.")
                  }
                >
                  <Check className="mr-1 h-3.5 w-3.5" /> Use this
                </Button>
              )}
              <Button
                size="sm"
                variant="secondary"
                className="rounded-full"
                disabled={busy}
                onClick={() =>
                  run(() => syncTwimlApp({ data: { sid: app.sid } }), "URLs pointed at SixVox.")
                }
              >
                <RefreshCw className="mr-1 h-3.5 w-3.5" /> Point at SixVox
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="rounded-full text-destructive"
                disabled={busy}
                onClick={() =>
                  run(() => deleteTwimlApp({ data: { sid: app.sid } }), "TwiML App deleted.")
                }
              >
                <Trash2 className="h-3.5 w-3.5" />
                <span className="sr-only">Delete</span>
              </Button>
            </div>
          </li>
        ))}
      </ul>

      {info ? (
        <div className="glass-panel space-y-1 rounded-3xl px-4 py-3 text-[0.65rem] break-all text-muted-foreground">
          <p>Voice: {info.voiceUrl}</p>
          <p>Messaging: {info.smsUrl}</p>
          <p>Status: {info.statusUrl}</p>
        </div>
      ) : null}
    </section>
  );
}
