import { createFileRoute } from "@tanstack/react-router";

type TranscriptTurn = { role?: string; message?: string; time_in_call_secs?: number };

export const Route = createFileRoute("/api/public/elevenlabs/post-call")({
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
        const meta = (data["conversation_initiation_client_data"] ?? {}) as Record<string, unknown>;
        const dynamic = (meta["dynamic_variables"] ?? {}) as Record<string, unknown>;

        const callSid =
          (dynamic["call_sid"] as string) ||
          (dynamic["system__call_sid"] as string) ||
          ((data["metadata"] as Record<string, unknown> | undefined)?.["call_sid"] as string) ||
          "";
        if (!callSid) return new Response("ok (no call sid)");

        const appNumber =
          (dynamic["called_number"] as string) ||
          (dynamic["system__called_number"] as string) ||
          "";
        const transcript = (data["transcript"] as TranscriptTurn[] | undefined) ?? [];
        const analysis = (data["analysis"] ?? {}) as Record<string, unknown>;
        const summary = (analysis["transcript_summary"] as string) ?? null;

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        await supabaseAdmin.from("ai_conversations").upsert(
          {
            call_sid: callSid,
            app_number: appNumber,
            agent_id: (data["agent_id"] as string) ?? null,
            conversation_id: (data["conversation_id"] as string) ?? null,
            transcript,
            summary,
          },
          { onConflict: "call_sid" },
        );

        if (summary) {
          await supabaseAdmin
            .from("calls")
            .update({ transcription: summary })
            .eq("sid", callSid);
        }

        if (appNumber) {
          const { notifyNumberWatchers } = await import("@/lib/push.server");
          await notifyNumberWatchers(supabaseAdmin as never, appNumber, {
            title: "AI assistant took a call",
            body: summary ? summary.slice(0, 140) : "Tap to read the transcript.",
            url: `/calls?q=${encodeURIComponent(callSid)}`,
            tag: `ai-${callSid}`,
            type: "message",
          });
        }

        // Fold the conversation into call intelligence: transcript, summary,
        // follow-ups and the caller's rolling memory.
        if (appNumber && transcript.length) {
          const { ingestCallTranscript } = await import("@/lib/intelligence.server");
          const contactNumber =
            (dynamic["caller_number"] as string) ||
            (dynamic["system__caller_id"] as string) ||
            null;
          await ingestCallTranscript(supabaseAdmin as never, {
            callSid,
            appNumber,
            contactNumber,
            direction: "inbound",
            source: "elevenlabs",
            turns: transcript
              .filter((turn) => (turn.message ?? "").trim())
              .map((turn) => ({
                speaker: turn.role === "agent" ? ("assistant" as const) : ("caller" as const),
                text: (turn.message ?? "").trim(),
                ...(typeof turn.time_in_call_secs === "number"
                  ? { at: turn.time_in_call_secs }
                  : {}),
              })),
          });
        }

        return new Response("ok");
      },
    },
  },
});