import { apiBaseUrl, previewMode } from "./config";
import {
  previewBootstrap,
  previewCalls,
  previewConversations,
  previewMessages,
  previewVoicemails,
} from "./preview-data";
import type { Bootstrap, CallRow, Conversation, Message, VoicemailRow } from "./types";

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

type Json = Record<string, unknown>;

async function request<T>(
  path: string,
  accessToken: string,
  init?: { method?: string; body?: unknown; query?: Record<string, string | undefined> },
): Promise<T> {
  const url = new URL(`${apiBaseUrl()}/api/mobile/${path}`);
  for (const [key, value] of Object.entries(init?.query ?? {})) {
    if (value) url.searchParams.set(key, value);
  }
  const response = await fetch(url, {
    method: init?.method ?? "GET",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: "application/json",
      ...(init?.body ? { "Content-Type": "application/json" } : {}),
    },
    ...(init?.body ? { body: JSON.stringify(init.body) } : {}),
  });
  const payload = (await response.json().catch(() => ({}))) as Json;
  if (!response.ok || payload["ok"] === false) {
    const error = typeof payload["error"] === "string" ? payload["error"] : `Request failed (${response.status})`;
    throw new ApiError(error, response.status);
  }
  return payload as T;
}

export const api = {
  async bootstrap(token: string): Promise<Bootstrap> {
    if (previewMode()) return previewBootstrap;
    return request("bootstrap", token);
  },
  async voiceToken(token: string, platform: "ios" | "android", environment: "sandbox" | "production") {
    type VoiceTokenResponse = {
      ok: boolean;
      reason?: string;
      pushCredentialConfigured?: boolean;
      grant?: { token: string; identity: string; expiresAt: string };
    };
    if (previewMode()) {
      const preview: VoiceTokenResponse = {
        ok: true,
        pushCredentialConfigured: false,
        grant: { token: "preview", identity: "agent_preview", expiresAt: "" },
      };
      return preview;
    }
    return request<VoiceTokenResponse>("voice/token", token, {
      method: "POST",
      body: { platform, environment },
    });
  },
  async presence(
    token: string,
    body: { online: boolean; platform: "ios" | "android"; deviceId: string },
  ): Promise<void> {
    if (previewMode()) return;
    await request("voice/presence", token, { method: "POST", body });
  },
  async ack(token: string, callSid: string): Promise<void> {
    if (previewMode() || !/^CA[0-9a-f]{32}$/i.test(callSid)) return;
    await request("voice/ack", token, { method: "POST", body: { callSid } });
  },
  async inbox(token: string, q?: string): Promise<Conversation[]> {
    if (previewMode()) return previewConversations;
    const result = await request<{ conversations: Conversation[] }>("inbox", token, { query: { q } });
    return result.conversations;
  },
  async messages(token: string, conversationId: string): Promise<{ conversation: Conversation; messages: Message[] }> {
    if (previewMode()) {
      const conversation = previewConversations[0];
      if (!conversation) throw new ApiError("Conversation not found.", 404);
      return { conversation, messages: previewMessages };
    }
    return request("messages", token, { query: { conversationId } });
  },
  async sendMessage(token: string, body: { appNumber: string; to: string; body: string }): Promise<void> {
    if (previewMode()) return;
    await request("messages/send", token, { method: "POST", body });
  },
  async markRead(token: string, conversationId: string): Promise<void> {
    if (previewMode()) return;
    await request("conversations/read", token, { method: "POST", body: { conversationId } });
  },
  async calls(token: string): Promise<CallRow[]> {
    if (previewMode()) return previewCalls;
    const result = await request<{ calls: CallRow[] }>("calls", token);
    return result.calls;
  },
  async voicemails(token: string): Promise<VoicemailRow[]> {
    if (previewMode()) return previewVoicemails;
    const result = await request<{ voicemails: VoicemailRow[] }>("voicemail", token);
    return result.voicemails;
  },
  async voicemailAudio(token: string, callSid: string): Promise<string> {
    if (previewMode()) throw new ApiError("Playback needs a real recording.", 404);
    const result = await request<{ dataUrl: string }>("voicemail/audio", token, {
      method: "POST",
      body: { callSid },
    });
    return result.dataUrl;
  },
  async updateProfile(
    token: string,
    body: { displayName?: string; agentPhone?: string | null },
  ): Promise<void> {
    if (previewMode()) return;
    await request("profile", token, { method: "POST", body });
  },
};
