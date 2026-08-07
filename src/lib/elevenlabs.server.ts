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

async function el<T>(path: string, init: RequestInit = {}): Promise<T> {
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
export async function agentStreamUrl(agentId: string): Promise<string> {
  try {
    const data = await el<{ signed_url?: string }>(
      `/v1/convai/conversation/get-signed-url?agent_id=${encodeURIComponent(agentId)}`,
    );
    if (data.signed_url) return data.signed_url;
  } catch {
    // Public agent, or the key lacks the endpoint — fall back to the open URL.
  }
  return `wss://api.elevenlabs.io/v1/convai/conversation?agent_id=${encodeURIComponent(agentId)}`;
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