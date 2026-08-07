import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { getVoiceToken, setVoicePresence } from "@/lib/twilio.functions";
import { errorMessage } from "@/lib/format";

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
  call: (to: string, callerId: string) => Promise<void>;
  accept: () => void;
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

  const resetCall = useCallback(() => {
    callRef.current = null;
    setCallState("idle");
    setRemoteParty("");
    setMuted(false);
    setStartedAt(null);
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
      const outgoing = await device.connect({ params: { To: to, CallerId: callerId } });
      bindCall(outgoing, "outbound", to);
    },
    [bindCall, error],
  );

  const value: VoiceContextValue = {
    status,
    callState,
    remoteParty,
    direction,
    muted,
    startedAt,
    error,
    ready: status === "ready",
    call,
    accept: () => callRef.current?.accept(),
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