import type { MobilePushEnvironment, MobileVoicePlatform } from "./mobile-push-credentials";

export type VoiceTokenRequest = {
  platform: MobileVoicePlatform;
  environment: MobilePushEnvironment;
};

export type PresenceRequest = {
  online: boolean;
  platform: MobileVoicePlatform;
  deviceId: string;
};

function record(body: unknown): Record<string, unknown> | null {
  if (!body || typeof body !== "object" || Array.isArray(body)) return null;
  return body as Record<string, unknown>;
}

function platformOf(value: unknown): MobileVoicePlatform | null {
  return value === "ios" || value === "android" ? value : null;
}

function environmentOf(value: unknown, platform: MobileVoicePlatform): MobilePushEnvironment {
  if (platform === "android") return "production";
  return value === "sandbox" ? "sandbox" : "production";
}

export function parseVoiceTokenBody(body: unknown): VoiceTokenRequest | { error: string } {
  const row = record(body);
  if (!row) return { error: "Expected a JSON object." };
  const platform = platformOf(row["platform"]);
  if (!platform) return { error: "platform must be ios or android." };
  return { platform, environment: environmentOf(row["environment"], platform) };
}

export function parsePresenceBody(body: unknown): PresenceRequest | { error: string } {
  const row = record(body);
  if (!row) return { error: "Expected a JSON object." };
  const platform = platformOf(row["platform"]);
  if (!platform) return { error: "platform must be ios or android." };
  if (typeof row["online"] !== "boolean") return { error: "online must be a boolean." };
  if (typeof row["deviceId"] !== "string" || !row["deviceId"].trim()) {
    return { error: "deviceId is required." };
  }
  return { online: row["online"], platform, deviceId: row["deviceId"].trim() };
}

export function parseCallSidBody(body: unknown): { callSid: string } | { error: string } {
  const row = record(body);
  const callSid = row?.["callSid"];
  if (typeof callSid !== "string" || !/^CA[0-9a-f]{32}$/i.test(callSid)) {
    return { error: "callSid must be a Twilio Call SID." };
  }
  return { callSid };
}

export function parseSendMessageBody(
  body: unknown,
): { appNumber: string; to: string; body: string } | { error: string } {
  const row = record(body);
  if (!row) return { error: "Expected a JSON object." };
  const appNumber = row["appNumber"];
  const to = row["to"];
  const text = row["body"];
  if (typeof appNumber !== "string" || !appNumber.trim())
    return { error: "appNumber is required." };
  if (typeof to !== "string" || !to.trim()) return { error: "to is required." };
  if (typeof text !== "string" || !text.trim()) return { error: "body is required." };
  if (text.length > 1600) return { error: "body is too long." };
  return { appNumber: appNumber.trim(), to: to.trim(), body: text };
}

export function parseReadBody(body: unknown): { conversationId: string } | { error: string } {
  const row = record(body);
  const conversationId = row?.["conversationId"];
  if (typeof conversationId !== "string" || !conversationId.trim()) {
    return { error: "conversationId is required." };
  }
  return { conversationId: conversationId.trim() };
}

export function parseProfileBody(
  body: unknown,
): { displayName?: string; agentPhone?: string | null } | { error: string } {
  const row = record(body);
  if (!row) return { error: "Expected a JSON object." };
  const patch: { displayName?: string; agentPhone?: string | null } = {};
  if ("displayName" in row) {
    if (typeof row["displayName"] !== "string") return { error: "displayName must be a string." };
    patch.displayName = row["displayName"].trim();
  }
  if ("agentPhone" in row) {
    const phone = row["agentPhone"];
    if (phone !== null && typeof phone !== "string")
      return { error: "agentPhone must be a string or null." };
    patch.agentPhone = phone === null ? null : phone.trim();
  }
  if (!("displayName" in patch) && !("agentPhone" in patch)) {
    return { error: "Nothing to update." };
  }
  return patch;
}
