import { createFileRoute } from "@tanstack/react-router";

type Turn = { role?: string; message?: string; time_in_call_secs?: number };

/** ElevenLabs post-call webhook for the website concierge. */
export const Route = createFileRoute("/api/public/agent/post-call")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const url = new URL(request.url);
        const expected = process.env["TWILIO_WEBHOOK_TOKEN"] ?? "";
        if (!expected || url.searchParams.get("t") !== expected) {
          return new Response("Unauthorized", { status: 401 });
        }

        const payload = (await request.json().catch(() => null)) as {
          data?: Record<string, unknown>;
        } | null;
        if (!payload) return new Response("Bad request", { status: 400 });

        const data = (payload.data ?? payload) as Record<string, unknown>;
        const clientData = (data["conversation_initiation_client_data"] ?? {}) as Record<
          string,
          unknown
        >;
        const dynamic = (clientData["dynamic_variables"] ?? {}) as Record<string, unknown>;
        const sessionKey = String(dynamic["session_key"] ?? "");
        if (!sessionKey) return new Response("ok (not a concierge session)");

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { conversationForKey, saveTranscript } = await import("@/lib/concierge/store.server");
        const conversation = await conversationForKey(supabaseAdmin as never, sessionKey);
        if (!conversation) return new Response("ok (unknown session)");

        const turns = ((data["transcript"] as Turn[] | undefined) ?? [])
          .filter((turn) => (turn.message ?? "").trim())
          .map((turn) => ({
            role: turn.role === "agent" ? "assistant" : "user",
            content: (turn.message ?? "").trim(),
            ...(typeof turn.time_in_call_secs === "number" ? { at: turn.time_in_call_secs } : {}),
          }));
        await saveTranscript(supabaseAdmin as never, conversation.id, turns);

        const analysis = (data["analysis"] ?? {}) as Record<string, unknown>;
        const collected = (analysis["data_collection_results"] ?? {}) as Record<
          string,
          { value?: unknown }
        >;
        const evaluation = (analysis["evaluation_criteria_results"] ?? {}) as Record<
          string,
          { result?: string }
        >;
        const metadata = (data["metadata"] ?? {}) as Record<string, unknown>;
        const unanswered = String(collected["unanswered"]?.value ?? "").trim();

        await supabaseAdmin
          .from("chat_conversations")
          .update({
            conversation_id: (data["conversation_id"] as string) ?? null,
            summary: (analysis["transcript_summary"] as string) ?? null,
            status: conversation_status(evaluation, unanswered),
            answered: evaluation["answered"]?.result === "success",
            unanswered_questions: unanswered ? [unanswered] : [],
            duration_seconds: Number(metadata["call_duration_secs"] ?? 0) || null,
            turn_count: turns.length,
          })
          .eq("id", conversation.id);

        // Fold a captured email/need into the lead pipeline when the model
        // collected it but never called capture_lead.
        const email = String(collected["lead_email"]?.value ?? "").trim();
        const phone = String(collected["lead_phone"]?.value ?? "").trim();
        if (email || phone) {
          const { count } = await supabaseAdmin
            .from("chat_leads")
            .select("id", { count: "exact", head: true })
            .eq("conversation_id", conversation.id);
          if (!count) {
            await supabaseAdmin.from("chat_leads").insert({
              conversation_id: conversation.id,
              email: email || null,
              phone: phone || null,
              need: String(collected["lead_need"]?.value ?? "") || null,
              plan_interest: String(collected["plan_interest"]?.value ?? "") || null,
              page: conversation.page,
              source: "concierge-auto",
            });
          }
        }

        return new Response("ok");
      },
    },
  },
});

function conversation_status(
  evaluation: Record<string, { result?: string }>,
  unanswered: string,
): string {
  if (unanswered) return "needs_knowledge";
  return evaluation["answered"]?.result === "failure" ? "review" : "closed";
}
