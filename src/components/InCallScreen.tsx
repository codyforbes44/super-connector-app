import { Check, Mic, MicOff, Phone, PhoneOff, Volume2, Volume1, Grid3x3 } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { formatPhone } from "@/lib/format";
import { haptic } from "@/lib/haptics";
import { useVoice } from "@/lib/voice-device";
import { startRingtone, stopRingtone } from "@/lib/ringtone";
import { cn } from "@/lib/utils";

const DIGITS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "*", "0", "#"];

function useElapsed(startedAt: number | null) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!startedAt) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [startedAt]);
  if (!startedAt) return null;
  const total = Math.max(0, Math.floor((now - startedAt) / 1000));
  const mins = String(Math.floor(total / 60)).padStart(2, "0");
  const secs = String(total % 60).padStart(2, "0");
  return `${mins}:${secs}`;
}

/** Full-screen active-call surface, rendered above every authenticated screen. */
export function InCallScreen() {
  const voice = useVoice();
  const [keypad, setKeypad] = useState(false);
  const [typed, setTyped] = useState("");
  const [outputSheet, setOutputSheet] = useState(false);
  const elapsed = useElapsed(voice.startedAt);

  const ringing = voice.callState === "ringing" && voice.direction === "inbound";
  useEffect(() => {
    if (ringing) startRingtone();
    else stopRingtone();
    return () => stopRingtone();
  }, [ringing]);

  useEffect(() => {
    if (voice.callState === "idle") {
      setKeypad(false);
      setTyped("");
      setOutputSheet(false);
    }
    // Drop any "Incoming call" push notification once the call is in the app.
    if (typeof navigator !== "undefined" && navigator.serviceWorker?.controller) {
      navigator.serviceWorker.controller.postMessage({ type: "clear-call-notifications" });
    }
  }, [voice.callState]);

  if (voice.callState === "idle") return null;

  const party = voice.remoteParty.replace(/^client:/, "");
  const ringingIn = ringing;
  const label = ringingIn
    ? "Incoming call"
    : voice.callState === "active"
      ? (elapsed ?? "Connected")
      : "Calling…";

  return (
    <div className="app-gradient fixed inset-0 z-[60] flex flex-col items-center justify-between px-6 py-14">
      <div className="flex flex-col items-center gap-4 pt-8">
        <span className="ring-glow flex h-28 w-28 items-center justify-center rounded-full text-3xl font-semibold">
          {party.replace(/\D/g, "").slice(-2) || "?"}
        </span>
        <h1 className="font-display text-center text-2xl font-semibold">{formatPhone(party)}</h1>
        <p className="tabular text-sm text-muted-foreground">{label}</p>
      </div>

      {keypad ? (
        <div className="w-full max-w-[17rem] space-y-3">
          <p className="tabular min-h-6 text-center text-lg">{typed}</p>
          <div className="grid grid-cols-3 gap-3">
            {DIGITS.map((digit) => (
              <button
                key={digit}
                type="button"
                onPointerDown={() => haptic("light")}
                onClick={() => {
                  voice.sendDigit(digit);
                  setTyped((prev) => (prev + digit).slice(0, 24));
                }}
                className="key-raised mx-auto flex h-14 w-14 items-center justify-center rounded-full font-display text-lg font-semibold transition-transform duration-75 active:scale-95"
              >
                {digit}
              </button>
            ))}
          </div>
        </div>
      ) : (
        <div className="grid w-full max-w-[17rem] grid-cols-3 gap-y-6">
          <ControlButton
            icon={voice.muted ? MicOff : Mic}
            label={voice.muted ? "Unmute" : "Mute"}
            active={voice.muted}
            onClick={voice.toggleMute}
          />
          <ControlButton icon={Grid3x3} label="Keypad" onClick={() => setKeypad(true)} />
          <ControlButton
            icon={voice.speakerOn ? Volume2 : Volume1}
            label="Speaker"
            active={voice.speakerOn}
            onClick={() => {
              haptic("light");
              void voice.toggleSpeaker();
            }}
            // More than two outputs (headset, Bluetooth): let the user pick.
            onLongPress={
              voice.audioOutputSupported && voice.outputDevices.length > 1
                ? () => {
                    haptic("medium");
                    setOutputSheet(true);
                  }
                : undefined
            }
          />
        </div>
      )}

      {outputSheet ? (
        <div
          className="fixed inset-0 z-[70] flex items-end bg-background/70 backdrop-blur-sm"
          role="dialog"
          aria-label="Choose audio output"
          onClick={() => setOutputSheet(false)}
        >
          <div
            className="glass-panel m-3 w-full space-y-1 rounded-3xl p-3"
            onClick={(event) => event.stopPropagation()}
          >
            <p className="px-2 pb-1 text-xs text-muted-foreground">Audio output</p>
            {voice.outputDevices.map((device) => (
              <button
                key={device.id}
                type="button"
                onClick={() => {
                  haptic("light");
                  void voice.selectOutput(device.id);
                  setOutputSheet(false);
                }}
                className="flex min-h-11 w-full items-center justify-between gap-3 rounded-2xl px-3 text-left text-sm"
              >
                <span>{device.label}</span>
                {voice.outputDeviceId === device.id ? (
                  <Check className="h-4 w-4 shrink-0 text-success" />
                ) : null}
              </button>
            ))}
          </div>
        </div>
      ) : null}

      <div className="flex items-center gap-10 pb-4">
        {keypad ? (
          <button
            type="button"
            onClick={() => setKeypad(false)}
            className="key-raised rounded-full px-5 py-3 text-sm font-medium"
          >
            Hide keypad
          </button>
        ) : null}
        {ringingIn ? (
          <button
            type="button"
            onClick={voice.accept}
            className="key-call flex h-18 w-18 items-center justify-center rounded-full p-5 transition-transform active:scale-95"
          >
            <Phone className="h-7 w-7" />
            <span className="sr-only">Answer</span>
          </button>
        ) : null}
        <button
          type="button"
          onClick={voice.hangup}
          className={cn(
            "key-end flex items-center justify-center rounded-full p-5 transition-transform active:scale-95",
          )}
        >
          <PhoneOff className="h-7 w-7" />
          <span className="sr-only">{ringingIn ? "Decline" : "End call"}</span>
        </button>
      </div>
    </div>
  );
}

function ControlButton({
  icon: Icon,
  label,
  onClick,
  onLongPress,
  active,
  disabled,
}: {
  icon: typeof Mic;
  label: string;
  onClick: () => void;
  onLongPress?: () => void;
  active?: boolean;
  disabled?: boolean;
}) {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fired = useRef(false);

  const clear = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
  };

  return (
    <button
      type="button"
      onPointerDown={() => {
        if (!onLongPress) return;
        fired.current = false;
        clear();
        timer.current = setTimeout(() => {
          fired.current = true;
          onLongPress();
        }, 450);
      }}
      onPointerUp={clear}
      onPointerLeave={clear}
      onContextMenu={(event) => {
        if (onLongPress) event.preventDefault();
      }}
      onClick={() => {
        clear();
        // A completed long-press already opened the picker.
        if (fired.current) {
          fired.current = false;
          return;
        }
        onClick();
      }}
      disabled={disabled}
      className="flex flex-col items-center gap-2 disabled:opacity-40"
    >
      <span
        className={cn(
          "flex h-14 w-14 items-center justify-center rounded-full",
          active ? "key-signal" : "key-raised",
        )}
      >
        <Icon className="h-5 w-5" />
      </span>
      <span className="text-[0.7rem] text-muted-foreground">{label}</span>
    </button>
  );
}