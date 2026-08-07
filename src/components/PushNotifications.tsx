import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Bell, BellOff, Smartphone } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { errorMessage } from "@/lib/format";
import {
  currentSubscription,
  disablePush,
  enablePush,
  pushPermission,
  pushSupported,
} from "@/lib/push";
import {
  listPushDevices,
  removePushSubscription,
  savePushSubscription,
  sendTestPush,
} from "@/lib/push.functions";

export function PushNotifications() {
  const queryClient = useQueryClient();
  const [ready, setReady] = useState(false);
  const [supported, setSupported] = useState(false);
  const [permission, setPermission] = useState<NotificationPermission | "unsupported">(
    "unsupported",
  );
  const [thisDevice, setThisDevice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const devices = useQuery({ queryKey: ["push-devices"], queryFn: () => listPushDevices() });

  useEffect(() => {
    let active = true;
    void (async () => {
      const sub = await currentSubscription();
      if (!active) return;
      setSupported(pushSupported());
      setPermission(pushPermission());
      setThisDevice(sub?.endpoint ?? null);
      setReady(true);
    })();
    return () => {
      active = false;
    };
  }, []);

  async function turnOn() {
    setBusy(true);
    try {
      const sub = await enablePush();
      await savePushSubscription({ data: sub });
      setThisDevice(sub.endpoint);
      setPermission("granted");
      await queryClient.invalidateQueries({ queryKey: ["push-devices"] });
      toast.success("Alerts on. You'll be notified about new messages and missed calls.");
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setBusy(false);
    }
  }

  async function turnOff() {
    setBusy(true);
    try {
      const endpoint = (await disablePush()) ?? thisDevice;
      if (endpoint) await removePushSubscription({ data: { endpoint } });
      setThisDevice(null);
      await queryClient.invalidateQueries({ queryKey: ["push-devices"] });
      toast.success("Alerts off on this device.");
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setBusy(false);
    }
  }

  async function test() {
    setBusy(true);
    try {
      const { sent } = await sendTestPush({ data: undefined });
      toast[sent ? "success" : "error"](
        sent ? "Test alert sent." : "No registered devices to notify yet.",
      );
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setBusy(false);
    }
  }

  const otherDevices = (devices.data ?? []).filter((d) => d.endpoint !== thisDevice).length;

  return (
    <section className="space-y-3 px-4 py-4">
      <h2 className="font-display text-sm font-semibold">Push alerts</h2>
      <p className="text-xs text-muted-foreground">
        Get an instant notification on this device for every inbound message, missed call and
        voicemail on numbers you can see. On iPhone, add SignalBox to your Home Screen first.
      </p>

      {!ready ? (
        <div className="h-11 animate-pulse rounded-full bg-secondary" />
      ) : !supported ? (
        <p className="glass-panel rounded-2xl px-3 py-2.5 text-xs text-muted-foreground">
          This browser can't receive push notifications. Install the app to your Home Screen or use
          a modern mobile browser.
        </p>
      ) : permission === "denied" ? (
        <p className="glass-panel rounded-2xl px-3 py-2.5 text-xs text-muted-foreground">
          Notifications are blocked in your browser settings for this site. Allow them, then reload
          to turn alerts on.
        </p>
      ) : thisDevice ? (
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" className="h-11 rounded-full" disabled={busy} onClick={turnOff}>
            <BellOff className="mr-2 h-4 w-4" /> Turn off on this device
          </Button>
          <Button variant="ghost" className="h-11 rounded-full" disabled={busy} onClick={test}>
            Send test alert
          </Button>
        </div>
      ) : (
        <Button className="key-signal h-11 w-full rounded-full" disabled={busy} onClick={turnOn}>
          <Bell className="mr-2 h-4 w-4" /> Enable alerts on this device
        </Button>
      )}

      {otherDevices > 0 ? (
        <p className="flex items-center gap-2 text-xs text-muted-foreground">
          <Smartphone className="h-3.5 w-3.5" />
          {otherDevices} other device{otherDevices === 1 ? "" : "s"} also receiving alerts
        </p>
      ) : null}
    </section>
  );
}