import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { getVoiceToken, setVoicePresence } from "@/lib/twilio.functions";
import { errorMessage } from "@/lib/format";
import {
  startCallKeepalive,
  reviveCallAudio,
  rebindAudioDevices,
  watchAudioDevices,
  resetAudioBinding,
  type DeviceAudio,
} from "@/lib/call-keepalive";
import {
  ensureMicrophone,
  readMicPermission,
  watchMicPermission,
  type MicState,
} from "@/lib/media";

type Call = {
  disconnect: () => void;
  accept: () => void;
  reject: () => void;
  mute: (state: boolean) => void;
  isMuted: () => boolean;
  sendDigits: (digits: string) => void;
  parameters: Record<string, string>;
  customParameters?: Map<string, string>;
  on: (event: string, handler: (...args: unknown[]) => void) => void;
};

type DeviceStatus = "idle" | "registering" | "ready" | "unavailable";
type CallState = "idle" | "connecting" | "ringing" | "active";

type VoiceContextValue = {
  status: DeviceStatus;
  callState: CallState;
  remoteParty: string;
  direction: "inbound" | "outbound";
  muted: boolean;
  startedAt: number | null;
  error: string | null;
  ready: boolean;
  micState: MicState;
  requestMic: () => Promise<boolean>;
  call: (to: string, callerId: string) => Promise<void>;
  accept: () => void | Promise<void>;
  hangup: () => void;
  toggleMute: () => void;
  sendDigit: (digit: string) => void;
};

const VoiceContext = createContext<VoiceContextValue | null>(null);

type Grant = { token: string; identity: string; expiresAt: string };

type GrantResult = { ok: true; grant: Grant } | { ok: false; reason: string };

async function fetchGrant(): Promise<GrantResult> {
  return (await getVoiceToken()) as unknown as GrantResult;
}

export function useVoice(): VoiceContextValue {
  const ctx = useContext(VoiceContext);
  if (!ctx) throw new Error("useVoice must be used inside <VoiceProvider>");
  return ctx;
}

export function VoiceProvider({ children }: { children: React.ReactNode }) {
  const deviceRef = useRef<{
    connect: (opts: { params: Record<string, string> }) => Promise<Call>;
    destroy: () => void;
    updateToken: (token: string) => void;
    on: (event: string, handler: (...args: never[]) => void) => void;
    audio?: DeviceAudio;
  } | null>(null);
  const callRef = useRef<Call | null>(null);
  const refreshRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const presenceRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const [status, setStatus] = useState<DeviceStatus>("idle");
  const [callState, setCallState] = useState<CallState>("idle");
  const [remoteParty, setRemoteParty] = useState("");
  const [direction, setDirection] = useState<"inbound" | "outbound">("outbound");
  const [muted, setMuted] = useState(false);
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [micState, setMicState] = useState<MicState>("unknown");

  useEffect(() => {
    let dispose: (() => void) | undefined;
    void readMicPermission().then(setMicState);
    void watchMicPermission(setMicState).then((off) => {
      dispose = off;
    });
    return () => dispose?.();
  }, []);

  const requestMic = useCallback(async () => {
    try {
      await ensureMicrophone();
      setMicState("granted");
      return true;
    } catch (err) {
      setMicState(await readMicPermission());
      toast.error(errorMessage(err));
      return false;
    }
  }, []);

  const resetCall = useCallback(() => {
    callRef.current = null;
    setCallState("idle");
    setRemoteParty("");
    setMuted(false);
    setStartedAt(null);
    resetAudioBinding();
  }, []);

  const bindCall = useCallback(
    (call: Call, dir: "inbound" | "outbound", party: string) => {
      callRef.current = call;
      setDirection(dir);
      setRemoteParty(party);
      setCallState(dir === "inbound" ? "ringing" : "connecting");
      call.on("accept", () => {
        setCallState("active");
        setStartedAt(Date.now());
      });
      call.on("disconnect", resetCall);
      call.on("cancel", resetCall);
      call.on("reject", resetCall);
      call.on("error", (...args: unknown[]) => {
        const err = args[0] as { message?: string } | undefined;
        toast.error(err?.message ?? "Call failed");
        resetCall();
      });
    },
    [resetCall],
  );

  useEffect(() => {
    let cancelled = false;

    async function boot() {
      setStatus("registering");
      try {
        const result = await fetchGrant();
        if (cancelled) return;
        if (!result.ok) {
          setError(result.reason);
          setStatus("unavailable");
          return;
        }
        const grant = result.grant;
        const { Device } = await import("@twilio/voice-sdk");

        const device = new Device(grant.token, {
          logLevel: "error",
          codecPreferences: ["opus", "pcmu"] as never,
        });
        deviceRef.current = device as unknown as typeof deviceRef.current;

        device.on("registered", () => {
          setStatus("ready");
          // Tell the server this device can take calls, and keep saying so.
          const beat = () => {
            void setVoicePresence({ data: { online: true } }).catch(() => {});
          };
          beat();
          if (presenceRef.current) clearInterval(presenceRef.current);
          presenceRef.current = setInterval(beat, 45_000);
        });
        device.on("error", (err: { message?: string }) => {
          setError(err?.message ?? "Voice device error");
          setStatus("unavailable");
          if (presenceRef.current) clearInterval(presenceRef.current);
          presenceRef.current = null;
          void setVoicePresence({ data: { online: false } }).catch(() => {});
        });
        device.on("incoming", (call: unknown) => {
          const incoming = call as Call;
          if (callRef.current) {
            incoming.reject();
            return;
          }
          bindCall(incoming, "inbound", incoming.parameters["From"] ?? "Unknown");
        });

        await device.register();

        const msUntilRefresh = Math.max(
          60_000,
          new Date(grant.expiresAt).getTime() - Date.now() - 120_000,
        );
        refreshRef.current = setTimeout(async () => {
          try {
            const next = await fetchGrant();
            if (next.ok) device.updateToken(next.grant.token);
          } catch {
            /* the next boot will retry */
          }
        }, msUntilRefresh);
      } catch (err) {
        if (cancelled) return;
        setError(errorMessage(err));
        setStatus("unavailable");
      }
    }

    void boot();
    return () => {
      cancelled = true;
      if (refreshRef.current) clearTimeout(refreshRef.current);
      if (presenceRef.current) clearInterval(presenceRef.current);
      presenceRef.current = null;
      void setVoicePresence({ data: { online: false } }).catch(() => {});
      deviceRef.current?.destroy();
      deviceRef.current = null;
    };
  }, [bindCall]);

  const call = useCallback(
    async (to: string, callerId: string) => {
      const device = deviceRef.current;
      if (!device) throw new Error(error ?? "In-app calling isn't available yet.");
      await ensureMicrophone();
      setMicState("granted");
      const outgoing = await device.connect({ params: { To: to, CallerId: callerId } });
      bindCall(outgoing, "outbound", to);
    },
    [bindCall, error],
  );

  // While a call is up, hold a wake lock and re-assert local audio whenever the
  // user comes back from another app — switching apps must never mute the mic.
  useEffect(() => {
    if (callState !== "active" && callState !== "connecting") return;
    let cancelled = false;
    let running = false;
    let queued = false;
    let debounce: ReturnType<typeof setTimeout> | null = null;

    // Follow the OS route: a headset paired or unplugged while we were in the
    // background must be picked up before the mic track is re-asserted.
    const resync = async (announce: boolean) => {
      if (running) {
        // Never overlap two rebinds — the second would fight for the mic.
        queued = queued || announce;
        return;
      }
      running = true;
      const toastId = announce ? toast.loading("Audio device changed — reconnecting…") : null;
      try {
        const result = await rebindAudioDevices(deviceRef.current?.audio);
        // Always re-assert the mic track, even if device selection was refused.
        reviveCallAudio(callRef.current, muted);
        if (cancelled || toastId === null) return;
        if (result.ok) {
          const target = result.inputLabel ?? result.outputLabel;
          toast.success(target ? `Audio moved to ${target}` : "Audio reconnected", { id: toastId });
        } else {
          toast.warning("Kept you on the previous audio device", {
            id: toastId,
            description: "We couldn't switch automatically — your call is still connected.",
          });
        }
      } finally {
        running = false;
        if (!cancelled && queued) {
          queued = false;
          void resync(true);
        }
      }
    };

    // Returning from another app: silent re-assert, no toast.
    const stopKeepalive = startCallKeepalive(() => void resync(false));
    // A real device change (headset, Bluetooth): tell the user what happened.
    const stopDeviceWatch = watchAudioDevices(() => {
      if (debounce) clearTimeout(debounce);
      // Plug/pair events fire in bursts; settle before touching the mic.
      debounce = setTimeout(() => void resync(true), 350);
    });
    return () => {
      cancelled = true;
      if (debounce) clearTimeout(debounce);
      stopKeepalive();
      stopDeviceWatch();
    };
  }, [callState, muted]);

  const value: VoiceContextValue = {
    status,
    callState,
    remoteParty,
    direction,
    muted,
    startedAt,
    error,
    ready: status === "ready",
    micState,
    requestMic,
    call,
    accept: async () => {
      const active = callRef.current;
      if (!active) return;
      const ok = await requestMic();
      if (!ok) return;
      active.accept();
    },
    hangup: () => {
      const active = callRef.current;
      if (!active) return;
      if (callState === "ringing" && direction === "inbound") active.reject();
      else active.disconnect();
      resetCall();
    },
    toggleMute: () => {
      const active = callRef.current;
      if (!active) return;
      const next = !muted;
      active.mute(next);
      setMuted(next);
    },
    sendDigit: (digit: string) => callRef.current?.sendDigits(digit),
  };

  return <VoiceContext.Provider value={value}>{children}</VoiceContext.Provider>;
}