import { Mic, MicOff, ShieldCheck } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useVoice } from "@/lib/voice-device";
import { cn } from "@/lib/utils";

/** Shows microphone access status and lets the user grant it before a call. */
export function DeviceAccess({ className }: { className?: string }) {
  const { micState, requestMic } = useVoice();

  const granted = micState === "granted";
  const blocked = micState === "denied" || micState === "unsupported";

  return (
    <section className={cn("glass-panel space-y-3 rounded-3xl p-5", className)}>
      <div className="flex items-start gap-3">
        <span
          className={cn(
            "grid size-9 shrink-0 place-items-center rounded-full",
            granted ? "bg-primary/15 text-primary" : blocked ? "bg-destructive/15 text-destructive" : "bg-white/5 text-muted-foreground",
          )}
        >
          {blocked ? <MicOff className="size-4" /> : granted ? <ShieldCheck className="size-4" /> : <Mic className="size-4" />}
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-display text-base font-semibold">Microphone access</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {granted
              ? "Your microphone is ready for in-app calls."
              : micState === "denied"
                ? "Blocked. Allow the microphone for SixVox in your browser or phone settings, then reload."
                : micState === "unsupported"
                  ? "This browser can't reach a microphone. Open SixVox in Safari or Chrome."
                  : "SixVox needs your microphone to place and answer calls in the app."}
          </p>
        </div>
      </div>
      {!granted && micState !== "unsupported" ? (
        <Button className="w-full rounded-full" onClick={() => void requestMic()}>
          Allow microphone
        </Button>
      ) : null}
    </section>
  );
}
