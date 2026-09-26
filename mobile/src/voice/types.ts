export type VoiceStatus = "idle" | "registering" | "registered" | "unavailable";
export type CallPhase = "idle" | "ringing" | "connecting" | "active";
export type CallDirection = "inbound" | "outbound";

export type VoiceSnapshot = {
  status: VoiceStatus;
  phase: CallPhase;
  remoteParty: string;
  direction: CallDirection;
  muted: boolean;
  speaker: boolean;
  error: string | null;
  pushConfigured: boolean;
  startedAt: number | null;
};

export const idleSnapshot: VoiceSnapshot = {
  status: "idle",
  phase: "idle",
  remoteParty: "",
  direction: "outbound",
  muted: false,
  speaker: false,
  error: null,
  pushConfigured: false,
  startedAt: null,
};

export type VoiceController = {
  getSnapshot: () => VoiceSnapshot;
  subscribe: (listener: () => void) => () => void;
  register: (accessToken: string) => Promise<void>;
  unregister: () => Promise<void>;
  call: (to: string, callerId: string) => Promise<void>;
  accept: () => Promise<void>;
  reject: () => Promise<void>;
  hangup: () => Promise<void>;
  toggleMute: () => Promise<void>;
  toggleSpeaker: () => Promise<void>;
  sendDigit: (digit: string) => Promise<void>;
  previewRing: () => void;
};
