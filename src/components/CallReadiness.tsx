import { useEffect, useState } from "react";
import { Bell, Loader2, PhoneCall, TriangleAlert } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { errorMessage } from "@/lib/format";
import { currentSubscription, enablePush, pushPermission, pushSupported } from "@/lib/push";
import { savePushSubscription } from "@/lib/push.functions";
import { useVoice } from "@/lib/voice-device";
import { cn } from "@/lib/utils";

function isIosSafari() {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent;
  const ios = /iPad|iPhone|iPod/.test(ua) || (ua.includes("Mac") && "ontouchend" in document);
  const standalone =
    (window.navigator as unknown as { standalone?: boolean }).standalone === true ||
    window.matchMedia("(display-mode: standalone)").matches;
  return ios && !standalone;
}

/** Compact status strip: can this device place calls, and will it ring? */
export function CallReadiness() {
  const voice = useVoice();
  const [subscribed, setSubscribed] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  const [homeScreen, setHomeScreen] = useState(false);

  useEffect(() => {
    let active = true;
    void currentSubscription().then((sub) => {
      if (active) setSubscribed(Boolean(sub) && pushPermission() === "granted");
    });
    setHomeScreen(isIosSafari());
    return () => {
      active = false;
    };
  }, []);

  async function turnOn() {
    setBusy(true);
    try {
      const sub = await enablePush();
      await savePushSubscription({ data: sub });
      setSubscribed(true);
      toast.success("Alerts on — this device will ring for incoming calls.");
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setBusy(false);
    }
  }

  const callLabel =
    voice.status === "ready"
      ? "In-app calling connected"
      : voice.status === "registering"
        ? "Connecting in-app calling…"
        : voice.error
          ? `In-app calling unavailable — ${voice.error}`
          : "In-app calling unavailable — calls will use your phone instead";

  const needsPush = pushSupported() && subscribed === false;

  return (
    <div className="space-y-2 px-4 pb-1">
      <div className="glass-panel flex items-center gap-2.5 rounded-2xl px-3.5 py-2.5">
        <span
          className={cn(
            "grid size-7 shrink-0 place-items-center rounded-full",
            voice.status === "ready"
              ? "bg-primary/15 text-primary"
              : voice.status === "registering"
                ? "surface-track text-muted-foreground"
                : "bg-destructive/15 text-destructive",
          )}
        >
          {voice.status === "registering" ? (
            <Loader2 className="size-3.5 animate-spin" />
          ) : voice.status === "ready" ? (
            <PhoneCall className="size-3.5" />
          ) : (
            <TriangleAlert className="size-3.5" />
          )}
        </span>
        <p className="min-w-0 flex-1 text-xs text-muted-foreground">{callLabel}</p>
      </div>

      {needsPush ? (
        <div className="glass-panel flex items-center gap-2.5 rounded-2xl px-3.5 py-2.5">
          <Bell className="size-4 shrink-0 text-muted-foreground" />
          <p className="min-w-0 flex-1 text-xs text-muted-foreground">
            {homeScreen
              ? "Add SixVox to your Home Screen to get call alerts on iPhone."
              : "Turn on alerts so this device rings for incoming calls."}
          </p>
          {homeScreen ? null : (
            <Button size="sm" className="h-8 rounded-full" disabled={busy} onClick={turnOn}>
              Enable
            </Button>
          )}
        </div>
      ) : null}
    </div>
  );
}
