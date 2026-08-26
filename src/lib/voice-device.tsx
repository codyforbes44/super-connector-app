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
  listOutputDevices,
  outputSelectionSupported,
  setOutputDevice,
  type OutputChoice,
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
  /** False on iOS, where the platform owns earpiece/loudspeaker routing. */
  audioOutputSupported: boolean;
  outputDevices: OutputChoice[];
  outputDeviceId: string | null;
  speakerOn: boolean;
  toggleSpeaker: () => Promise<void>;
  selectOutput: (id: string) => Promise<void>;
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
  const [outputDevices, setOutputDevices] = useState<OutputChoice[]>([]);
  const [outputDeviceId, setOutputDeviceId] = useState<string | null>(null);
  const [speakerOn, setSpeakerOn] = useState(false);
  // Mirrors outputDeviceId for the rebind effect without re-running it.
  const outputRef = useRef<string | null>(null);
  const audioOutputSupported = outputSelectionSupported();

  useEffect(() => {
    let dispose: (() => void) | undefined;
    void readMicPermission().then(setMicState);
    void watchMicPermission(setMicState).then((off) => {
      dispose = off;
    });
    return () => dispose?.();
  }, []);

  // Satisfy the autoplay policy from the first tap so an incoming call can
  // ring out loud without waiting for the user to touch the screen.
  useEffect(() => {
    const prime = () => primeRingtone();
    const events = ["pointerdown", "keydown", "touchstart"] as const;
    for (const evt of events) window.addEventListener(evt, prime, { passive: true });
    return () => {
      for (const evt of events) window.removeEventListener(evt, prime);
    };
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
    outputRef.current = null;
    setOutputDeviceId(null);
    setSpeakerOn(false);
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
          presenceRef.current = setInterval(beat, 30_000);
          // Background tabs get their timers throttled, so check in again the
          // moment the app comes back to the foreground.
          if (!visibilityBeatRef.current) {
            const onVisible = () => {
              if (document.visibilityState === "visible") beat();
            };
            document.addEventListener("visibilitychange", onVisible);
            window.addEventListener("focus", onVisible);
            visibilityBeatRef.current = () => {
              document.removeEventListener("visibilitychange", onVisible);
              window.removeEventListener("focus", onVisible);
            };
          }
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
        const audio = deviceRef.current?.audio;
        // A hand-picked output survives backgrounding and headset churn.
        const result = await rebindAudioDevices(audio, outputRef.current);
        setOutputDevices(listOutputDevices(audio));
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

  // Keep the picker list fresh for the duration of a call.
  useEffect(() => {
    if (callState === "idle") return;
    const read = () => setOutputDevices(listOutputDevices(deviceRef.current?.audio));
    read();
    const timer = setTimeout(read, 600);
    const stop = watchAudioDevices(read);
    return () => {
      clearTimeout(timer);
      stop();
    };
  }, [callState]);

  const selectOutput = useCallback(
    async (id: string) => {
      const audio = deviceRef.current?.audio;
      const ok = await setOutputDevice(audio, id);
      if (!ok) {
        toast.warning("Couldn't switch audio output", {
          description: "Your browser refused the change — the call is still connected.",
        });
        return;
      }
      outputRef.current = id;
      setOutputDeviceId(id);
      const choice = listOutputDevices(audio).find((d) => d.id === id);
      setSpeakerOn(choice?.kind === "speaker");
    },
    [],
  );

  const toggleSpeaker = useCallback(async () => {
    if (!audioOutputSupported) {
      toast.info("iOS controls the speaker", {
        description:
          "Use your phone's own speaker control during the call, or connect a headset.",
      });
      return;
    }
    const audio = deviceRef.current?.audio;
    const devices = listOutputDevices(audio);
    setOutputDevices(devices);
    const speaker = devices.find((d) => d.kind === "speaker");
    const normal = devices.find((d) => d.kind === "earpiece") ?? devices.find((d) => d.id === "default") ?? devices[0];
    const target = speakerOn ? normal : (speaker ?? normal);
    if (!target || (!speakerOn && !speaker)) {
      toast.info("No separate loudspeaker on this device", {
        description: "This browser only exposes one audio output for calls.",
      });
      return;
    }
    await selectOutput(target.id);
  }, [audioOutputSupported, selectOutput, speakerOn]);

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
    audioOutputSupported,
    outputDevices,
    outputDeviceId,
    speakerOn,
    toggleSpeaker,
    selectOutput,
  };

  return <VoiceContext.Provider value={value}>{children}</VoiceContext.Provider>;
}