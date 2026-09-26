/**
 * Server-only ElevenLabs access layer.
 * Uses the unrestricted account API key (ELEVENLABS_API_KEY) directly against
 * api.elevenlabs.io — ElevenLabs is not routed through the connector gateway.
 */

import {
  extractEmergencyBlock,
  mergeEmergencyPrompt,
  transferToolConfig,
} from "@/lib/emergency-keywords";

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

/* --------------------------------------------------------- agent allowlist */

/**
 * The ElevenLabs API key is shared with other products on the same account, so
 * every agent-facing call is scoped to an allowlist. Configure it with
 * `ELEVENLABS_ALLOWED_AGENT_IDS` (comma-separated agent ids). When the variable
 * is unset we fall back to the SixVox Concierge/Vox agent only.
 *
 * Agents this app created itself (audit log) or already assigned to one of our
 * numbers are treated as ours too, so the in-app "New agent" flow keeps working
 * without an env change.
 */
export const DEFAULT_ALLOWED_AGENT_IDS = ["agent_2701kzz3f6aee48a38vw0qsehbks"];

const DEV_NAME_PREFIX = "SixVox";

export class AgentNotAllowedError extends Error {
  status = 403;
  constructor(agentId: string) {
    super(`Agent ${agentId} is not available to this workspace.`);
    this.name = "AgentNotAllowedError";
  }
}

function configuredAgentIds(): { ids: string[]; explicitlyEmpty: boolean } {
  const raw = process.env["ELEVENLABS_ALLOWED_AGENT_IDS"];
  if (raw === undefined) return { ids: DEFAULT_ALLOWED_AGENT_IDS, explicitlyEmpty: false };
  const ids = raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  return { ids, explicitlyEmpty: ids.length === 0 };
}

function isDev(): boolean {
  return process.env["NODE_ENV"] !== "production";
}

/** Agent ids this workspace owns: configured allowlist + agents we created. */
export async function workspaceAgentIds(): Promise<Set<string>> {
  const set = new Set(configuredAgentIds().ids);
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const [{ data: numbers }, { data: events }] = await Promise.all([
      supabaseAdmin.from("phone_numbers").select("elevenlabs_agent_id"),
      supabaseAdmin
        .from("audit_log")
        .select("detail")
        .eq("action", "elevenlabs.agent.create")
        .limit(500),
    ]);
    for (const row of numbers ?? []) {
      const id = row["elevenlabs_agent_id"] as string | null;
      if (id) set.add(id);
    }
    for (const row of events ?? []) {
      const id = (row["detail"] as { agent_id?: string } | null)?.agent_id;
      if (id) set.add(id);
    }
  } catch {
    // Database unavailable — fall back to the configured allowlist alone.
  }
  return set;
}

export async function isAgentAllowed(agentId: string): Promise<boolean> {
  return (await workspaceAgentIds()).has(agentId);
}

/** Throws a 403-flavoured error when the agent belongs to someone else. */
export async function assertAgentAllowed(agentId: string): Promise<void> {
  if (!(await isAgentAllowed(agentId))) throw new AgentNotAllowedError(agentId);
}

export async function listAgents(): Promise<Agent[]> {
  const data = await el<{ agents?: Array<{ agent_id: string; name?: string }> }>(
    "/v1/convai/agents?page_size=100",
  );
  const all = (data.agents ?? []).map((a) => ({
    agent_id: a.agent_id,
    name: a.name ?? a.agent_id,
  }));
  const allowed = await workspaceAgentIds();
  if (allowed.size > 0) return all.filter((a) => allowed.has(a.agent_id));
  // Allowlist deliberately emptied: in dev show only clearly-ours agents by
  // name prefix; in production never dump the shared account.
  if (configuredAgentIds().explicitlyEmpty && isDev()) {
    return all.filter((a) => a.name.startsWith(DEV_NAME_PREFIX));
  }
  return [];
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
  await assertAgentAllowed(agentId);
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

type AgentPromptConfig = {
  prompt?: string;
  built_in_tools?: Record<string, unknown>;
};

export async function updateAgent(agentId: string, input: AgentInput): Promise<{ ok: true }> {
  await assertAgentAllowed(agentId);
  let tools: Record<string, unknown> | undefined;
  let preservedBlock: string | null = null;
  try {
    const raw = await el<{ conversation_config?: { agent?: { prompt?: AgentPromptConfig } } }>(
      `/v1/convai/agents/${encodeURIComponent(agentId)}`,
    );
    const prompt = raw.conversation_config?.agent?.prompt;
    tools = prompt?.built_in_tools;
    preservedBlock = extractEmergencyBlock(prompt?.prompt ?? "");
  } catch (error) {
    console.error(`could not read agent ${agentId} before update`, error);
  }
  const body = agentBody(input);
  let promptText = input.prompt;
  if (preservedBlock && !promptText.includes("[sixvox-emergency]") && tools?.["transfer_to_number"]) {
    promptText = `${promptText}\n\n${preservedBlock}`.trim();
  }
  body.conversation_config.agent.prompt.prompt = promptText;
  if (tools && Object.keys(tools).length > 0) {
    (body.conversation_config.agent.prompt as AgentPromptConfig).built_in_tools = tools;
  }
  await el(`/v1/convai/agents/${encodeURIComponent(agentId)}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return { ok: true };
}

/**
 * Push the line's emergency keywords onto the ElevenLabs agent as a conference
 * transfer_to_number tool. Saving line settings calls this; the voice webhook does not.
 */
export async function syncEmergencyTransfer(args: {
  agentId: string | null;
  keywords: string[];
  phone: string | null;
}): Promise<{ synced: boolean; detail: string }> {
  if (!args.agentId) return { synced: false, detail: "This line has no AI agent yet." };
  if (!hasElevenLabs()) return { synced: false, detail: "ElevenLabs is not connected." };
  try {
    await assertAgentAllowed(args.agentId);
    const raw = await el<{ conversation_config?: { agent?: { prompt?: AgentPromptConfig } } }>(
      `/v1/convai/agents/${encodeURIComponent(args.agentId)}`,
    );
    const prompt = raw.conversation_config?.agent?.prompt ?? {};
    const tools = { ...(prompt.built_in_tools ?? {}) };
    const phone = args.phone;
    if (phone && args.keywords.length > 0) {
      tools["transfer_to_number"] = transferToolConfig(phone, args.keywords);
    } else {
      delete tools["transfer_to_number"];
    }
    await el(`/v1/convai/agents/${encodeURIComponent(args.agentId)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        conversation_config: {
          agent: {
            prompt: {
              ...prompt,
              prompt: mergeEmergencyPrompt(prompt.prompt ?? "", args.keywords, phone),
              built_in_tools: tools,
            },
          },
        },
      }),
    });
    return {
      synced: true,
      detail: phone
        ? "Emergency transfer is on the AI agent."
        : "Emergency transfer was removed from the AI agent.",
    };
  } catch (error) {
    const detail = error instanceof Error ? error.message : "Could not update the AI agent.";
    console.error(`emergency transfer sync failed for ${args.agentId}`, error);
    return { synced: false, detail };
  }
}

export async function deleteAgent(agentId: string): Promise<{ ok: true }> {
  await assertAgentAllowed(agentId);
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
  await assertAgentAllowed(agentId);
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
