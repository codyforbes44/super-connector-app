import { useEffect, useState } from "react";
import { Bell } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { errorMessage } from "@/lib/format";
import { currentSubscription, enablePush, pushPermission, pushSupported } from "@/lib/push";
import { savePushSubscription } from "@/lib/push.functions";

const SNOOZE_KEY = "sixvox.notifications.snoozed-until";
const SNOOZE_MS = 3 * 24 * 60 * 60 * 1000;

/**
 * On-screen prompt asking the user to turn on device notifications. Shown when
 * the browser can receive push but this device has no subscription yet, so
 * people who never opened Settings still get calls, texts and voicemail alerts.
 */
export function EnableNotificationsPrompt() {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      if (!pushSupported()) return;
      if (pushPermission() === "denied") return;
      const snoozed = Number(window.localStorage.getItem(SNOOZE_KEY) ?? 0);
      if (snoozed > Date.now()) return;
      const sub = await currentSubscription();
      if (cancelled || sub) return;
      setOpen(true);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  function snooze() {
    window.localStorage.setItem(SNOOZE_KEY, String(Date.now() + SNOOZE_MS));
    setOpen(false);
  }

  async function enable() {
    setBusy(true);
    try {
      const sub = await enablePush();
      await savePushSubscription({ data: sub });
      window.localStorage.removeItem(SNOOZE_KEY);
      setOpen(false);
      toast.success("Notifications on — calls, texts and voicemail will alert this device.");
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(next) => (next ? setOpen(true) : snooze())}>
      <DialogContent className="max-w-sm rounded-3xl">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/15 text-primary">
          <Bell className="h-6 w-6" />
        </div>
        <DialogTitle className="text-center font-display text-xl">
          Turn on notifications
        </DialogTitle>
        <DialogDescription className="text-center text-sm">
          Enable all notifications so incoming calls, texts and voicemail alert you the moment they
          arrive. On iPhone, add SixVox to your Home Screen first.
        </DialogDescription>
        <div className="mt-2 grid gap-2">
          <Button className="key-signal h-11 rounded-xl" disabled={busy} onClick={() => void enable()}>
            Enable all notifications
          </Button>
          <Button variant="ghost" className="h-11 rounded-xl" onClick={snooze}>
            Not now
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
