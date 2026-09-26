import { AudioDevice, Call, CallInvite, Voice } from "@twilio/voice-react-native-sdk";
import { PermissionsAndroid, Platform } from "react-native";

import { api } from "@/api";
import { previewMode, pushEnvironment } from "@/config";
import { createSnapshotStore } from "./store";
import type { CallDirection, VoiceController } from "./types";

const store = createSnapshotStore();
let voice: Voice | null = null;
let wired = false;
let sessionToken: string | null = null;
let voiceToken: string | null = null;
let invite: CallInvite | null = null;
let activeCall: Call | null = null;

function messageOf(error: unknown): string {
  if (error instanceof Error && error.message) return error.message;
  if (error && typeof error === "object" && "message" in error) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === "string" && message) return message;
  }
  return "The calling service hit an error.";
}

function sdk(): Voice {
  if (!voice) voice = new Voice();
  return voice;
}

function bindInvite(next: CallInvite) {
  invite = next;
  store.set({
    phase: "ringing",
    direction: "inbound",
    remoteParty: next.getFrom(),
    muted: false,
    speaker: false,
    startedAt: null,
    error: null,
  });
  const token = sessionToken;
  if (token) {
    void api.ack(token, next.getCallSid()).catch(() => undefined);
  }
  next.on(CallInvite.Event.Accepted, (call) => {
    if (invite === next) invite = null;
    bindCall(call, "inbound");
  });
  next.on(CallInvite.Event.Rejected, () => {
    if (invite === next) invite = null;
    store.resetCall();
  });
  next.on(CallInvite.Event.Cancelled, () => {
    if (invite === next) invite = null;
    store.resetCall();
  });
}

function bindCall(call: Call, direction: CallDirection) {
  if (activeCall === call) return;
  activeCall = call;
  const remote = direction === "outbound" ? call.getTo() : call.getFrom();
  const connected = call.getState() === Call.State.Connected;
  store.set({
    phase: connected ? "active" : "connecting",
    direction,
    remoteParty: remote || store.getSnapshot().remoteParty,
    muted: Boolean(call.isMuted()),
    startedAt: connected ? Date.now() : null,
    error: null,
  });
  call.on(Call.Event.Connected, () => {
    if (activeCall !== call) return;
    store.set({ phase: "active", startedAt: store.getSnapshot().startedAt ?? Date.now() });
  });
  call.on(Call.Event.Ringing, () => {
    if (activeCall === call) store.set({ phase: "connecting" });
  });
  call.on(Call.Event.Disconnected, (error) => {
    if (activeCall === call) activeCall = null;
    store.resetCall();
    if (error) store.set({ error: messageOf(error) });
  });
  call.on(Call.Event.ConnectFailure, (error) => {
    if (activeCall === call) activeCall = null;
    store.resetCall();
    store.set({ error: messageOf(error) });
  });
}

function wire(instance: Voice) {
  if (wired) return;
  wired = true;
  instance.on(Voice.Event.Registered, () => store.set({ status: "registered", error: null }));
  instance.on(Voice.Event.Unregistered, () => store.set({ status: "idle", pushConfigured: false }));
  instance.on(Voice.Event.Error, (error) => store.set({ error: messageOf(error) }));
  instance.on(Voice.Event.CallInvite, (next) => {
    // The SDK's CallInvite listener type is circular, so the argument arrives as that alias.
    bindInvite(next as unknown as CallInvite);
  });
}

async function ensureAndroidPermissions(): Promise<string | null> {
  if (Platform.OS !== "android") return null;
  const notifications = "android.permission.POST_NOTIFICATIONS" as const;
  const result = await PermissionsAndroid.requestMultiple([
    PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
    notifications,
  ]);
  if (result[PermissionsAndroid.PERMISSIONS.RECORD_AUDIO] !== PermissionsAndroid.RESULTS.GRANTED) {
    return "Allow the microphone so SixVox can place and answer calls.";
  }
  return null;
}

async function selectRoute(speaker: boolean) {
  const { audioDevices } = await sdk().getAudioDevices();
  const wanted = speaker ? AudioDevice.Type.Speaker : AudioDevice.Type.Earpiece;
  const match = audioDevices.find((device) => device.type === wanted);
  if (match) await match.select();
}

export function createVoiceController(): VoiceController {
  return {
    getSnapshot: store.getSnapshot,
    subscribe: store.subscribe,
    async register(accessToken: string) {
      sessionToken = accessToken;
      if (previewMode()) {
        store.set({ status: "registered", pushConfigured: false, error: null });
        return;
      }
      store.set({ status: "registering", error: null });
      try {
        const permissionError = await ensureAndroidPermissions();
        const instance = sdk();
        wire(instance);
        if (Platform.OS === "ios") await instance.initializePushRegistry();
        const platform = Platform.OS === "ios" ? "ios" : "android";
        const minted = await api.voiceToken(accessToken, platform, pushEnvironment());
        if (!minted.grant?.token) {
          throw new Error(minted.reason ?? "Voice token was not issued.");
        }
        voiceToken = minted.grant.token;
        store.set({ pushConfigured: Boolean(minted.pushCredentialConfigured) });
        await instance.register(voiceToken);
        const pendingInvites = await instance.getCallInvites();
        for (const pending of pendingInvites.values()) bindInvite(pending);
        const pendingCalls = await instance.getCalls();
        for (const pending of pendingCalls.values()) {
          const direction: CallDirection = pending.getTo() ? "outbound" : "inbound";
          bindCall(pending, direction);
        }
        if (permissionError) store.set({ error: permissionError });
      } catch (error) {
        store.set({ status: "unavailable", error: messageOf(error) });
      }
    },
    async unregister() {
      const token = voiceToken;
      voiceToken = null;
      sessionToken = null;
      invite = null;
      activeCall = null;
      try {
        if (token && voice) await voice.unregister(token);
      } catch {
        // Signing out still clears local registration.
      }
      store.set({ status: "idle", pushConfigured: false, error: null });
      store.resetCall();
    },
    async call(to: string, callerId: string) {
      if (previewMode()) {
        store.set({
          phase: "active",
          direction: "outbound",
          remoteParty: to,
          muted: false,
          speaker: false,
          startedAt: Date.now(),
          error: null,
        });
        return;
      }
      if (!voiceToken) throw new Error("This phone is not registered for calls yet.");
      const outgoing = await sdk().connect(voiceToken, {
        params: { To: to, CallerId: callerId },
        contactHandle: to,
        notificationDisplayName: to,
      });
      bindCall(outgoing, "outbound");
      store.set({ phase: "connecting", direction: "outbound", remoteParty: to });
    },
    async accept() {
      const pending = invite;
      if (!pending) {
        if (store.getSnapshot().phase === "ringing") {
          store.set({ phase: "active", startedAt: Date.now() });
        }
        return;
      }
      const call = await pending.accept();
      invite = null;
      bindCall(call, "inbound");
    },
    async reject() {
      const pending = invite;
      invite = null;
      if (pending) await pending.reject();
      store.resetCall();
    },
    async hangup() {
      const call = activeCall;
      activeCall = null;
      invite = null;
      if (call) await call.disconnect();
      store.resetCall();
    },
    async toggleMute() {
      const call = activeCall;
      const muted = !store.getSnapshot().muted;
      if (call) await call.mute(muted);
      store.set({ muted });
    },
    async toggleSpeaker() {
      const speaker = !store.getSnapshot().speaker;
      if (!previewMode()) await selectRoute(speaker);
      store.set({ speaker });
    },
    async sendDigit(digit: string) {
      const call = activeCall;
      if (call) await call.sendDigits(digit);
    },
    previewRing() {
      store.set({
        phase: "ringing",
        direction: "inbound",
        remoteParty: "+15555550999",
        muted: false,
        speaker: false,
        startedAt: null,
        error: null,
      });
    },
  };
}
