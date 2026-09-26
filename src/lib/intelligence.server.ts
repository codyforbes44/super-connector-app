import type { SupabaseClient } from "@supabase/supabase-js";

const GATEWAY = "https://ai.gateway.lovable.dev/v1/responses";
const MODEL = "openai/gpt-5.6-sol";

export type TranscriptTurn = { speaker: "caller" | "assistant" | "you"; text: string; at?: number };

export type Analysis = {
  summary: string;
  intent: string;
  sentiment: "positive" | "neutral" | "negative";
  urgency: "low" | "normal" | "high";
  topics: string[];
  entities: Record<string, string>;
  action_items: Array<{ kind: string; label: string; value?: string }>;
};

/** Gateway failures we want the caller to be able to show a human message for. */
export class AiUnavailable extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

const SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["summary", "intent", "sentiment", "urgency", "topics", "entities", "action_items"],
  properties: {
    summary: { type: "string" },
    intent: { type: "string" },
    sentiment: { type: "string", enum: ["positive", "neutral", "negative"] },
    urgency: { type: "string", enum: ["low", "normal", "high"] },
    topics: { type: "array", items: { type: "string" } },
    entities: {
      type: "object",
      additionalProperties: false,
      required: ["name", "address", "date", "amount", "callback_number", "email"],
      properties: {
        name: { type: "string" },
        address: { type: "string" },
        date: { type: "string" },
        amount: { type: "string" },
        callback_number: { type: "string" },
        email: { type: "string" },
      },
    },
    action_items: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["kind", "label", "value"],
        properties: {
          kind: {
            type: "string",
            enum: [
              "save_contact",
              "save_place",
              "calendar_event",
              "send_sms",
              "send_email",
              "call_back",
              "note",
            ],
          },
          label: { type: "string" },
          value: { type: "string" },
        },
      },
    },
  },
} as const;

const SYSTEM = [
  "You analyse a single phone conversation for a personal phone app.",
  "Write the summary as one plain sentence in the phone owner's language, under 140 characters.",
  "intent is a short noun phrase describing what the caller wanted.",
  "topics: at most four short lowercase tags.",
  "entities: use an empty string for anything not clearly stated. Never guess.",
  "action_items: at most four concrete follow-ups the phone owner could tap once.",
  "Base everything only on the transcript. Do not invent facts.",
].join(" ");

function apiKey(): string {
  const key = process.env["LOVABLE_API_KEY"];
  if (!key) throw new AiUnavailable("AI is not configured for this workspace.", 500);
  return key;
}

/** One structured pass over a transcript. Throws AiUnavailable on gateway errors. */
export async function analyseTranscript(
  text: string,
  context: { from?: string; to?: string; direction?: string; instructions?: string | null },
): Promise<Analysis> {
  const response = await fetch(GATEWAY, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey()}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: MODEL,
      input: [
        { role: "system", content: SYSTEM },
        {
          role: "user",
          content: [
            `Direction: ${context.direction ?? "inbound"}`,
            `Caller: ${context.from ?? "unknown"}`,
            `Line: ${context.to ?? "unknown"}`,
            context.instructions ? `Phone owner's notes: ${context.instructions}` : "",
            "",
            "Transcript:",
            text.slice(0, 24_000),
          ]
            .filter(Boolean)
            .join("\n"),
        },
      ],
      text: {
        format: { type: "json_schema", name: "call_analysis", schema: SCHEMA, strict: true },
      },
    }),
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    if (response.status === 402) {
      throw new AiUnavailable("AI credits are exhausted for this workspace.", 402);
    }
    if (response.status === 429) {
      throw new AiUnavailable("AI is busy right now — try again in a moment.", 429);
    }
    throw new AiUnavailable(
      `AI request failed [${response.status}]: ${body.slice(0, 300)}`,
      response.status,
    );
  }

  const payload = (await response.json()) as {
    output?: Array<{ content?: Array<{ type?: string; text?: string }> }>;
  };
  const raw =
    payload.output
      ?.flatMap((item) => item.content ?? [])
      .find((part) => part.type === "output_text")?.text ?? "";
  try {
    return JSON.parse(raw) as Analysis;
  } catch {
    throw new AiUnavailable("AI returned an unreadable response.", 502);
  }
}

/** Flatten stored turns into readable text for the model and for search. */
export function turnsToText(turns: TranscriptTurn[]): string {
  return turns
    .filter((turn) => turn.text?.trim())
    .map(
      (turn) =>
        `${turn.speaker === "assistant" ? "Assistant" : turn.speaker === "you" ? "Me" : "Caller"}: ${turn.text.trim()}`,
    )
    .join("\n");
}

/** Who owns the line a call landed on. */
export async function ownerOfNumber(
  admin: SupabaseClient,
  appNumber: string,
): Promise<string | null> {
  if (!appNumber) return null;
  const { data } = await admin
    .from("phone_numbers")
    .select("assigned_to")
    .eq("phone_number", appNumber)
    .maybeSingle();
  return (data?.["assigned_to"] as string | null) ?? null;
}

/** Persist a transcript for a call, keyed by call sid + source. */
export async function saveTranscript(
  admin: SupabaseClient,
  input: {
    userId: string;
    callSid: string;
    appNumber?: string | null;
    contactNumber?: string | null;
    source: "elevenlabs" | "voicemail" | "stt";
    turns: TranscriptTurn[];
  },
): Promise<string> {
  const fullText = turnsToText(input.turns);
  await admin.from("call_transcripts").upsert(
    {
      user_id: input.userId,
      call_sid: input.callSid,
      app_number: input.appNumber ?? null,
      contact_number: input.contactNumber ?? null,
      source: input.source,
      turns: input.turns,
      full_text: fullText,
    },
    { onConflict: "call_sid,source" },
  );
  return fullText;
}

/**
 * Analyse one call and store the result, then fold it into the caller's
 * rolling memory. Safe to call more than once: existing rows are replaced.
 */
export async function runCallIntelligence(
  admin: SupabaseClient,
  input: {
    userId: string;
    callSid: string;
    text: string;
    appNumber?: string | null;
    contactNumber?: string | null;
    direction?: string;
  },
): Promise<Analysis | null> {
  const text = input.text.trim();
  if (text.length < 20) return null;

  const { data: profile } = await admin
    .from("profiles")
    .select("assistant_instructions")
    .eq("id", input.userId)
    .maybeSingle();

  const analysis = await analyseTranscript(text, {
    ...(input.contactNumber ? { from: input.contactNumber } : {}),
    ...(input.appNumber ? { to: input.appNumber } : {}),
    ...(input.direction ? { direction: input.direction } : {}),
    instructions: (profile?.["assistant_instructions"] as string | null) ?? null,
  });

  await admin.from("call_intelligence").upsert(
    {
      user_id: input.userId,
      call_sid: input.callSid,
      app_number: input.appNumber ?? null,
      contact_number: input.contactNumber ?? null,
      summary: analysis.summary,
      intent: analysis.intent,
      sentiment: analysis.sentiment,
      urgency: analysis.urgency,
      topics: analysis.topics ?? [],
      entities: analysis.entities ?? {},
      action_items: analysis.action_items ?? [],
      model: MODEL,
    },
    { onConflict: "call_sid" },
  );

  if (input.contactNumber) {
    await rememberContact(admin, input.userId, input.contactNumber, analysis.summary);
  }

  return analysis;
}

/** Keep a short rolling history per caller so the next call has context. */
export async function rememberContact(
  admin: SupabaseClient,
  userId: string,
  contactNumber: string,
  line: string,
): Promise<void> {
  const { data: existing } = await admin
    .from("contact_memory")
    .select("rolling_summary, call_count")
    .eq("user_id", userId)
    .eq("contact_number", contactNumber)
    .maybeSingle();

  const previous = ((existing?.["rolling_summary"] as string | null) ?? "")
    .split("\n")
    .filter(Boolean)
    .slice(-4);
  const stamped = `${new Date().toISOString().slice(0, 10)} — ${line}`;

  await admin.from("contact_memory").upsert(
    {
      user_id: userId,
      contact_number: contactNumber,
      rolling_summary: [...previous, stamped].join("\n"),
      last_call_at: new Date().toISOString(),
      call_count: ((existing?.["call_count"] as number | null) ?? 0) + 1,
    },
    { onConflict: "user_id,contact_number" },
  );
}

/**
 * Entry point for webhooks: store the transcript, then analyse it. Never
 * throws — a failed AI pass must not break call handling.
 */
export async function ingestCallTranscript(
  admin: SupabaseClient,
  input: {
    callSid: string;
    appNumber: string;
    contactNumber?: string | null;
    direction?: string;
    source: "elevenlabs" | "voicemail" | "stt";
    turns: TranscriptTurn[];
  },
): Promise<Analysis | null> {
  try {
    const userId = await ownerOfNumber(admin, input.appNumber);
    if (!userId) return null;
    const text = await saveTranscript(admin, {
      userId,
      callSid: input.callSid,
      appNumber: input.appNumber,
      contactNumber: input.contactNumber ?? null,
      source: input.source,
      turns: input.turns,
    });
    return await runCallIntelligence(admin, {
      userId,
      callSid: input.callSid,
      text,
      appNumber: input.appNumber,
      contactNumber: input.contactNumber ?? null,
      ...(input.direction ? { direction: input.direction } : {}),
    });
  } catch (error) {
    console.error("call intelligence failed", error);
    return null;
  }
}
