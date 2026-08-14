import { createFileRoute } from "@tanstack/react-router";

type Incoming = {
  sessionKey?: string;
  turns?: Array<{ role?: string; content?: string }>;
  durationSeconds?: number;
};

/**
 * The widget posts its own transcript when a conversation ends. The session key
 * is the capability: it is minted server-side and only ever handed to the
 * browser that opened that conversation.
 */
export const Route = createFileRoute("/api/public/agent/transcript")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const body = (await request.json().catch(() => null)) as Incoming | null;
        const sessionKey = body?.sessionKey ?? "";
        if (!sessionKey) return new Response("Bad request", { status: 400 });

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { conversationForKey, saveTranscript } = await import("@/lib/concierge/store.server");
        const conversation = await conversationForKey(supabaseAdmin as never, sessionKey);
        if (!conversation) return new Response("ok");

        const turns = (body?.turns ?? [])
          .filter((turn) => (turn.content ?? "").trim())
          .slice(0, 200)
          .map((turn) => ({
            role: turn.role === "assistant" ? "assistant" : "user",
            content: (turn.content ?? "").trim().slice(0, 4000),
          }));

        await saveTranscript(supabaseAdmin as never, conversation.id, turns);
        await supabaseAdmin
          .from("chat_conversations")
          .update({
            turn_count: turns.length,
            duration_seconds: Math.max(0, Math.round(Number(body?.durationSeconds ?? 0))) || null,
          })
          .eq("id", conversation.id);

        return new Response("ok");
      },
    },
  },
});
