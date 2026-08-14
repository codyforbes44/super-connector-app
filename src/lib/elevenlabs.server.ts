/**
 * Server-only ElevenLabs access layer.
 * Uses the unrestricted account API key (ELEVENLABS_API_KEY) directly against
 * api.elevenlabs.io — ElevenLabs is not routed through the connector gateway.
 */

const BASE = "https://api.elevenlabs.io";

export function elevenLabsKey(): string {
  const key = process.env["ELEVENLABS_API_KEY"];
  if (!key) throw new Error("ElevenLabs is not connected to this project.");
  return key;
}

export function hasElevenLabs(): boolean {
  return Boolean(process.env["ELEVENLABS_API_KEY"]);
}

export async function el<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(`${BASE}${path}`, {
    ...init,
    headers: { "xi-api-key": elevenLabsKey(), ...(init.headers ?? {}) },
  });
  if (!response.ok) {
    const body = await response.text();
    throw new Error(`ElevenLabs request failed [${response.status}]: ${body.slice(0, 400)}`);
  }
  return (await response.json()) as T;
}

export type Voice = {
  voice_id: string;
  name: string;
  category: string | null;
  labels: Record<string, string>;
  preview_url: string | null;
};

export async function listVoices(): Promise<Voice[]> {
  const data = await el<{ voices?: Voice[] }>("/v1/voices");
  return (data.voices ?? []).map((v) => ({
    voice_id: v.voice_id,
    name: v.name,
    category: v.category ?? null,
    labels: v.labels ?? {},
    preview_url: v.preview_url ?? null,
  }));
}

export type Agent = { agent_id: string; name: string };

export async function listAgents(): Promise<Agent[]> {
  const data = await el<{ agents?: Array<{ agent_id: string; name?: string }> }>(
    "/v1/convai/agents?page_size=100",
  );
  return (data.agents ?? []).map((a) => ({ agent_id: a.agent_id, name: a.name ?? a.agent_id }));
}

export type AgentDetail = {
  agent_id: string;
  name: string;
  prompt: string;
  firstMessage: string;
  language: string;
  voiceId: string | null;
};

type RawAgent = {
  agent_id?: string;
  name?: string;
  conversation_config?: {
    agent?: {
      prompt?: { prompt?: string };
      first_message?: string;
      language?: string;
    };
    tts?: { voice_id?: string };
  };
};

function toAgentDetail(raw: RawAgent, fallbackId: string): AgentDetail {
  const agent = raw.conversation_config?.agent ?? {};
  return {
    agent_id: raw.agent_id ?? fallbackId,
    name: raw.name ?? fallbackId,
    prompt: agent.prompt?.prompt ?? "",
    firstMessage: agent.first_message ?? "",
    language: agent.language ?? "en",
    voiceId: raw.conversation_config?.tts?.voice_id ?? null,
  };
}

export type AgentInput = {
  name: string;
  prompt: string;
  firstMessage: string;
  language: string;
  voiceId: string | null;
};

function agentBody(input: AgentInput) {
  return {
    name: input.name,
    conversation_config: {
      agent: {
        prompt: { prompt: input.prompt },
        first_message: input.firstMessage,
        language: input.language,
      },
      ...(input.voiceId ? { tts: { voice_id: input.voiceId } } : {}),
    },
  };
}

export async function getAgent(agentId: string): Promise<AgentDetail> {
  const raw = await el<RawAgent>(`/v1/convai/agents/${encodeURIComponent(agentId)}`);
  return toAgentDetail(raw, agentId);
}

export async function createAgent(input: AgentInput): Promise<{ agent_id: string }> {
  const data = await el<{ agent_id?: string }>("/v1/convai/agents/create", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(agentBody(input)),
  });
  if (!data.agent_id) throw new Error("ElevenLabs did not return an agent id.");
  return { agent_id: data.agent_id };
}

export async function updateAgent(agentId: string, input: AgentInput): Promise<{ ok: true }> {
  await el(`/v1/convai/agents/${encodeURIComponent(agentId)}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(agentBody(input)),
  });
  return { ok: true };
}

export async function deleteAgent(agentId: string): Promise<{ ok: true }> {
  const response = await fetch(`${BASE}/v1/convai/agents/${encodeURIComponent(agentId)}`, {
    method: "DELETE",
    headers: { "xi-api-key": elevenLabsKey() },
  });
  if (!response.ok) {
    const body = await response.text();
    throw new Error(`ElevenLabs delete failed [${response.status}]: ${body.slice(0, 400)}`);
  }
  return { ok: true };
}

/** Raw MP3 bytes for a piece of text. */
export async function synthesize(args: {
  text: string;
  voiceId: string;
  modelId?: string;
}): Promise<ArrayBuffer> {
  const response = await fetch(
    `${BASE}/v1/text-to-speech/${encodeURIComponent(args.voiceId)}?output_format=mp3_44100_128`,
    {
      method: "POST",
      headers: { "xi-api-key": elevenLabsKey(), "Content-Type": "application/json" },
      body: JSON.stringify({
        text: args.text,
        model_id: args.modelId ?? "eleven_multilingual_v2",
        voice_settings: { stability: 0.55, similarity_boost: 0.75, use_speaker_boost: true },
      }),
    },
  );
  if (!response.ok) {
    const body = await response.text();
    throw new Error(`ElevenLabs speech failed [${response.status}]: ${body.slice(0, 400)}`);
  }
  return response.arrayBuffer();
}

/**
 * Signed WebSocket URL for a private conversational agent. Public agents can be
 * streamed with the plain agent_id, so a failure here is not fatal.
 */
/**
 * ElevenLabs' native Twilio handler. Twilio POSTs the call parameters here and
 * ElevenLabs answers with its own TwiML, so the media stays in Twilio's format.
 * The raw ConvAI websocket must never be used from `<Stream>` — it speaks a
 * different protocol and Twilio drops it with error 31921 (silent call).
 */
export const ELEVENLABS_TWILIO_INBOUND_URL = "https://api.us.elevenlabs.io/twilio/inbound_call";

export type ElevenLabsPhoneNumber = {
  phone_number: string;
  phone_number_id: string;
  provider: string;
  assigned_agent: { agent_id: string } | null;
};

export async function listPhoneNumbers(): Promise<ElevenLabsPhoneNumber[]> {
  const data = await el<ElevenLabsPhoneNumber[]>("/v1/convai/phone-numbers");
  return Array.isArray(data) ? data : [];
}

/**
 * Make sure a Twilio number is registered with ElevenLabs and bound to the
 * agent the caller expects. Returns the ElevenLabs phone-number id, or null
 * when the number cannot be prepared (caller then degrades to voicemail).
 */
export async function ensureAgentPhoneNumber(
  phoneNumber: string,
  agentId: string,
): Promise<string | null> {
  const existing = (await listPhoneNumbers()).find((row) => row.phone_number === phoneNumber);

  if (existing) {
    if (existing.assigned_agent?.agent_id !== agentId) {
      await el(`/v1/convai/phone-numbers/${encodeURIComponent(existing.phone_number_id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ agent_id: agentId }),
      });
    }
    return existing.phone_number_id;
  }

  const sid = process.env["TWILIO_ACCOUNT_SID"];
  const token = process.env["TWILIO_AUTH_TOKEN"];
  if (!sid || !token) return null;

  const created = await el<{ phone_number_id?: string }>("/v1/convai/phone-numbers", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      provider: "twilio",
      phone_number: phoneNumber,
      label: phoneNumber,
      sid,
      token,
      agent_id: agentId,
    }),
  });
  return created.phone_number_id ?? null;
}

export async function accountStatus(): Promise<{
  connected: boolean;
  tier: string | null;
  characterCount: number | null;
  characterLimit: number | null;
  error: string | null;
}> {
  const empty = { tier: null, characterCount: null, characterLimit: null };
  if (!hasElevenLabs()) return { connected: false, ...empty, error: "No API key configured." };
  try {
    const data = await el<{
      tier?: string;
      character_count?: number;
      character_limit?: number;
    }>("/v1/user/subscription");
    return {
      connected: true,
      tier: data.tier ?? null,
      characterCount: data.character_count ?? null,
      characterLimit: data.character_limit ?? null,
      error: null,
    };
  } catch (error) {
    return {
      connected: false,
      ...empty,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}