import { createFileRoute } from "@tanstack/react-router";

function xml(body: string) {
  return new Response(`<?xml version="1.0" encoding="UTF-8"?><Response>${body}</Response>`, {
    headers: { "Content-Type": "text/xml" },
  });
}

/**
 * Twilio posts DialCallStatus here when a `<Dial>` finishes.
 * An empty response ends the call the same way a Dial without an action does.
 * Signature rules match every other Twilio webhook (PR #2).
 *
 * Inbound ring legs (`leg=clients` or `leg=owner_cell`) continue on no-answer:
 * in-app clients, then the owner's cell, then AI or voicemail. Text-back stays
 * on `handleInboundCallUpdate`, which runs when the dial ends the call. An
 * intermediate no-answer does not text, so the caller is not told we missed
 * them while the cell or the AI is still about to pick up.
 */
export const Route = createFileRoute("/api/public/twilio/dial-action")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { verifyTwilioWebhook, rejectWebhook } =
          await import("@/lib/twilio-signature.server");
        const auth = await verifyTwilioWebhook(request);
        if (!auth.ok) return rejectWebhook(request, auth.reason, auth.params);

        const url = new URL(request.url);
        const get = (key: string) => auth.params[key] ?? "";
        const leg = url.searchParams.get("leg");
        const dialStatus = get("DialCallStatus");
        const appNumber = get("To").replace(/^whatsapp:/, "");
        const callSid = get("CallSid");

        let ownerCell: string | null = null;
        const { continueInboundDial } = await import("@/lib/inbound-ring");
        const { UNANSWERED_DIAL_STATUSES } = await import("@/lib/missed-call");
        const unanswered = (UNANSWERED_DIAL_STATUSES as readonly string[]).includes(
          dialStatus.trim().toLowerCase(),
        );
        if (unanswered && leg === "clients") {
          try {
            const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
            const { VOICE_CONFIG_COLUMNS } = await import("@/lib/voice-answer.server");
            const { data: number } = await supabaseAdmin
              .from("phone_numbers")
              .select(`forward_to, ${VOICE_CONFIG_COLUMNS}`)
              .eq("phone_number", appNumber)
              .maybeSingle();
            const { loadInboundRing } = await import("@/lib/ring-targets.server");
            const ring = await loadInboundRing(supabaseAdmin as never, {
              appNumber,
              aiEnabled: Boolean(number?.answer_mode === "ai_agent" && number?.elevenlabs_agent_id),
              forwardTo: (number?.forward_to as string | null) ?? null,
            });
            ownerCell = ring.ownerCell;
          } catch (error) {
            console.error("owner cell lookup failed", error);
          }
        }

        const followUp = continueInboundDial({ dialStatus, leg, ownerCell });

        if (followUp.kind === "end") {
          if ((dialStatus === "completed" || dialStatus === "answered") && leg === "clients") {
            try {
              const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
              await supabaseAdmin
                .from("calls")
                .update({ answered_in_app: true, answer_path: "in_app" })
                .eq("sid", callSid);
            } catch (error) {
              console.error("in-app answer stamp failed", error);
            }
          }
          try {
            const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
            const { handleInboundCallUpdate } = await import("@/lib/call-automation.server");
            await handleInboundCallUpdate(supabaseAdmin as never, auth.params, "dial");
          } catch (error) {
            console.error("dial action automation failed", error);
          }
          return xml("");
        }

        try {
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          const { VOICE_CONFIG_COLUMNS, RING_SECONDS } = await import("@/lib/voice-answer.server");
          const { data: number } = await supabaseAdmin
            .from("phone_numbers")
            .select(`forward_to, ${VOICE_CONFIG_COLUMNS}`)
            .eq("phone_number", appNumber)
            .maybeSingle();
          const { lineRecordsCalls } = await import("@/lib/compliance/recording.server");
          const recordCalls = await lineRecordsCalls(supabaseAdmin as never, appNumber);

          const stamp = async (answerPath: string) => {
            if (!callSid) return;
            try {
              await supabaseAdmin
                .from("calls")
                .update({ answer_path: answerPath })
                .eq("sid", callSid);
            } catch {
              // bookkeeping only
            }
          };

          switch (followUp.kind) {
            case "owner_cell": {
              const { forwardedCallTwiml, inboundRingActionUrl } =
                await import("@/lib/voice-answer.server");
              await stamp("owner_cell");
              return xml(
                forwardedCallTwiml({
                  record: recordCalls,
                  callerId: appNumber,
                  destination: followUp.cell,
                  timeoutSeconds: RING_SECONDS,
                  actionUrl: inboundRingActionUrl("owner_cell"),
                }),
              );
            }
            case "ai": {
              const { voicemailTwiml } = await import("@/lib/voice-answer.server");
              const answer = await voicemailTwiml(
                supabaseAdmin as never,
                { ...(number ?? {}), record_calls: recordCalls },
                { callSid, from: get("From"), appNumber },
              );
              const handOff = answer.includes("<Redirect");
              await stamp(
                handOff ? "ai_agent" : ((number?.answer_mode as string | null) ?? "voicemail"),
              );
              return xml(answer);
            }
            default: {
              const _exhaustive: never = followUp;
              return _exhaustive;
            }
          }
        } catch (error) {
          console.error("dial follow-up failed", error);
          const { fallbackVoicemailTwiml } = await import("@/lib/voice-answer.server");
          return xml(fallbackVoicemailTwiml());
        }
      },
    },
  },
});
