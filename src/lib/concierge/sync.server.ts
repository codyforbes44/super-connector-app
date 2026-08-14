/**
 * Pushes the concierge agent's prompt, voice, tools and knowledge base to
 * ElevenLabs. Everything about the agent is versioned here, so a redeploy plus
 * one "Sync agent" click is enough to update it.
 */

import { PUBLIC_BASE_URL } from "@/lib/app.server";
import { el } from "@/lib/elevenlabs.server";
import { knowledgeDocs } from "./knowledge";
import { CLIENT_TOOLS, SERVER_TOOLS, jsonSchemaFor } from "./tool-defs";
import {
  CONCIERGE_AGENT_ID,
  CONCIERGE_AGENT_NAME,
  CONCIERGE_VOICE_ID,
  firstMessage,
  systemPrompt,
} from "./prompt";

function webhookToken(): string {
  const token = process.env["TWILIO_WEBHOOK_TOKEN"] ?? "";
  if (!token) throw new Error("Webhook token is not configured for this workspace.");
  return token;
}

export function toolUrl(name: string): string {
  return `${PUBLIC_BASE_URL}/api/public/agent/tool/${name}?t=${encodeURIComponent(webhookToken())}`;
}

export function postCallUrl(): string {
  return `${PUBLIC_BASE_URL}/api/public/agent/post-call?t=${encodeURIComponent(webhookToken())}`;
}

type ToolConfig = Record<string, unknown> & { name: string };

function serverToolConfigs(): ToolConfig[] {
  return SERVER_TOOLS.map((tool) => {
    const schema = jsonSchemaFor(tool.properties);
    const properties: Record<string, unknown> = { ...schema.properties };
    // The session key lets the endpoint resolve which visitor is talking
    // without trusting anything the model says.
    properties["session_key"] = {
      type: "string",
      dynamic_variable: "session_key",
      value_type: "dynamic_variable",
    };
    return {
      type: "webhook",
      name: tool.name,
      description: tool.description,
      response_timeout_secs: 20,
      disable_interruptions: false,
      api_schema: {
        url: toolUrl(tool.name),
        method: "POST",
        request_body_schema: {
          type: "object",
          description: `Arguments for ${tool.name}.`,
          properties,
          required: [...schema.required, "session_key"],
        },
      },
    };
  });
}

function clientToolConfigs(): ToolConfig[] {
  return CLIENT_TOOLS.map((tool) => {
    const schema = jsonSchemaFor(tool.properties);
    return {
      type: "client",
      name: tool.name,
      description: tool.description,
      expects_response: false,
      parameters: schema,
    };
  });
}

type ToolListItem = { id?: string; tool_config?: { name?: string } };

/** Create or update every concierge tool, returning their ElevenLabs ids. */
async function syncTools(): Promise<{ ids: string[]; created: number; updated: number }> {
  const existing = await el<{ tools?: ToolListItem[] }>("/v1/convai/tools");
  const byName = new Map<string, string>();
  for (const tool of existing.tools ?? []) {
    const name = tool.tool_config?.name;
    if (name && tool.id) byName.set(name, tool.id);
  }

  const ids: string[] = [];
  let created = 0;
  let updated = 0;

  for (const config of [...serverToolConfigs(), ...clientToolConfigs()]) {
    const id = byName.get(config.name);
    if (id) {
      await el(`/v1/convai/tools/${encodeURIComponent(id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tool_config: config }),
      });
      ids.push(id);
      updated += 1;
    } else {
      const result = await el<{ id?: string }>("/v1/convai/tools", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tool_config: config }),
      });
      if (result.id) ids.push(result.id);
      created += 1;
    }
  }

  return { ids, created, updated };
}

type KbItem = { id?: string; name?: string };

/** Replace the knowledge base documents with the current site content. */
async function syncKnowledgeBase(): Promise<Array<{ type: "text"; id: string; name: string }>> {
  const list = await el<{ documents?: KbItem[] }>("/v1/convai/knowledge-base?page_size=100");
  const existing = new Map<string, string>();
  for (const doc of list.documents ?? []) {
    if (doc.name && doc.id) existing.set(doc.name, doc.id);
  }

  const attached: Array<{ type: "text"; id: string; name: string }> = [];
  for (const doc of knowledgeDocs()) {
    const stale = existing.get(doc.name);
    if (stale) {
      await el(`/v1/convai/knowledge-base/${encodeURIComponent(stale)}?force=true`, {
        method: "DELETE",
      }).catch(() => undefined);
    }
    const created = await el<{ id?: string; name?: string }>("/v1/convai/knowledge-base/text", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: doc.name, text: doc.text }),
    });
    if (created.id) attached.push({ type: "text", id: created.id, name: doc.name });
  }
  return attached;
}

export type SyncResult = {
  agentId: string;
  tools: number;
  toolsCreated: number;
  toolsUpdated: number;
  documents: number;
  postCallUrl: string;
};

/** Full agent sync: knowledge base, tools, prompt, voice and platform settings. */
export async function syncConciergeAgent(): Promise<SyncResult> {
  const documents = await syncKnowledgeBase();
  const tools = await syncTools();

  await el(`/v1/convai/agents/${encodeURIComponent(CONCIERGE_AGENT_ID)}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: CONCIERGE_AGENT_NAME,
      conversation_config: {
        agent: {
          first_message: firstMessage(),
          language: "en",
          prompt: {
            prompt: systemPrompt(),
            llm: "gpt-4o-mini",
            temperature: 0.35,
            max_tokens: 600,
            tool_ids: tools.ids,
            knowledge_base: documents,
            rag: { enabled: true },
          },
        },
        tts: {
          voice_id: CONCIERGE_VOICE_ID,
          model_id: "eleven_flash_v2_5",
          stability: 0.45,
          similarity_boost: 0.75,
          speed: 1.0,
        },
        turn: { turn_timeout: 9, mode: "turn" },
        conversation: { max_duration_seconds: 900, text_only: false },
      },
      platform_settings: {
        widget: { variant: "full" },
        data_collection: {
          lead_email: { type: "string", description: "Email address the visitor gave, if any." },
          lead_phone: { type: "string", description: "Phone number the visitor gave, if any." },
          lead_need: { type: "string", description: "What the visitor is trying to solve." },
          plan_interest: { type: "string", description: "Plan they showed interest in." },
          unanswered: {
            type: "string",
            description: "Any question the assistant could not answer confidently.",
          },
        },
        evaluation: {
          criteria: [
            {
              id: "answered",
              name: "Question answered",
              type: "prompt",
              conversation_goal_prompt:
                "Did the assistant answer the visitor's questions accurately without inventing facts?",
            },
            {
              id: "next_step",
              name: "Clear next step",
              type: "prompt",
              conversation_goal_prompt:
                "Did the conversation end with a clear next step, such as a captured lead, a booked callback, a navigation, or a handoff?",
            },
          ],
        },
        workspace_overrides: {
          conversation_initiation_client_data_webhook: {
            url: postCallUrl(),
            request_headers: {},
          },
        },
        overrides: {
          conversation_config_override: {
            agent: { first_message: true, language: true, prompt: { prompt: false } },
          },
          custom_llm_extra_body: false,
          enable_conversation_initiation_client_data_from_webhook: false,
        },
      },
    }),
  });

  return {
    agentId: CONCIERGE_AGENT_ID,
    tools: tools.ids.length,
    toolsCreated: tools.created,
    toolsUpdated: tools.updated,
    documents: documents.length,
    postCallUrl: postCallUrl(),
  };
}

/** Short-lived WebRTC conversation token for the browser widget. */
export async function conversationToken(): Promise<string> {
  const data = await el<{ token?: string }>(
    `/v1/convai/conversation/token?agent_id=${encodeURIComponent(CONCIERGE_AGENT_ID)}`,
  );
  if (!data.token) throw new Error("ElevenLabs did not return a conversation token.");
  return data.token;
}
