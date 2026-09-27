import { createFileRoute } from "@tanstack/react-router";

function xml(body: string) {
  return new Response(`<?xml version="1.0" encoding="UTF-8"?><Response>${body}</Response>`, {
    headers: { "Content-Type": "text/xml" },
  });
}

export const Route = createFileRoute("/api/public/twilio/voice")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const url = new URL(request.url);
        const { verifyTwilioWebhook, rejectWebhook } =
          await import("@/lib/twilio-signature.server");
        const auth = await verifyTwilioWebhook(request);
        if (!auth.ok) return rejectWebhook(request, auth.reason, auth.params);

        const get = (key: string) => auth.params[key] ?? "";
        const appNumber = get("To").replace(/^whatsapp:/, "");

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        // A caller must always hear something valid. Any unexpected failure in
        // the logic below falls through to a plain greeting + recording rather
        // than Twilio's generic "an application error has occurred".
        try {
          const { resolveWorkspaceIdForNumber } = await import("@/lib/workspace.server");
          const { logWebhookError } = await import("@/lib/webhook-errors.server");
          const { workspaceId } = await resolveWorkspaceIdForNumber(appNumber);
          const callSid = get("CallSid");
          if (!workspaceId) {
            await logWebhookError(supabaseAdmin as never, {
              source: "voice",
              message: "no workspace for inbound number",
              url: url.toString(),
              callSid,
              appNumber,
            });
          } else {
            const { error: callError } = await supabaseAdmin.from("calls").upsert(
              {
                sid: callSid,
                direction: "inbound",
                from_number: get("From"),
                to_number: get("To"),
                app_number: appNumber,
                status: get("CallStatus") || "ringing",
                workspace_id: workspaceId,
              },
              { onConflict: "sid" },
            );
            if (callError) {
              await logWebhookError(supabaseAdmin as never, {
                source: "voice",
                message: callError.message,
                url: url.toString(),
                callSid,
                appNumber,
                workspaceId,
              });
            }
          }

          const { VOICE_CONFIG_COLUMNS } = await import("@/lib/voice-answer.server");
          try {
            const { noteForwardedCall } = await import("@/lib/byo.server");
            await noteForwardedCall(supabaseAdmin as never, appNumber);
          } catch {
            // forwarding bookkeeping must never break an inbound call
          }
          const { data: number } = await supabaseAdmin
            .from("phone_numbers")
            .select(`forward_to, assigned_to, workspace_id, ${VOICE_CONFIG_COLUMNS}`)
            .eq("phone_number", appNumber)
            .maybeSingle();

          const { lineRecordsCalls } = await import("@/lib/compliance/recording.server");
          const recordCalls = await lineRecordsCalls(supabaseAdmin as never, appNumber);

          if (number?.workspace_id) {
            await supabaseAdmin
              .from("calls")
              .update({ workspace_id: number.workspace_id as string })
              .eq("sid", get("CallSid"));
          }

          // Known spam never rings the owner and never reaches the AI.
          try {
            const { gateInboundCall } = await import("@/lib/spam-gate.server");
            const spam = await gateInboundCall(supabaseAdmin as never, {
              from: get("From"),
              appNumber,
              stirVerstat: get("StirVerstat"),
              callSid: get("CallSid"),
              assignedTo: (number?.assigned_to as string | null) ?? null,
            });
            if (!spam.ring) {
              return xml(`<Reject reason="rejected"/>`);
            }
          } catch (error) {
            console.error("spam gate failed open", error);
          }

          // Alert watchers immediately so a backgrounded device can pick up.
          try {
            const { notifyNumberWatchers } = await import("@/lib/push.server");
            await notifyNumberWatchers(supabaseAdmin as never, appNumber, {
              title: "Incoming call",
              body: `${get("From")} → ${appNumber}`,
              url: `/calls?incoming=${encodeURIComponent(get("CallSid"))}`,
              tag: `ring-${get("CallSid")}`,
              type: "call",
              requireInteraction: true,
            });
          } catch (error) {
            console.error("Push alert failed for inbound call:", error);
          }

          const aiAnswering = number?.answer_mode === "ai_agent" && number?.elevenlabs_agent_id;

          const {
            voicemailTwiml,
            classicVoicemailTwiml,
            ringbackTwiml,
            RING_SECONDS,
            forwardedCallTwiml,
            inboundClientDialTwiml,
            inboundRingActionUrl,
          } = await import("@/lib/voice-answer.server");

          // Hours are a separate read so a missing migration cannot change routing.
          let hoursRoute: "as_today" | "after_hours_ai" | "after_hours_voicemail" = "as_today";
          try {
            const { routeForHours, parseWeeklySchedule, parseHolidayDates } =
              await import("@/lib/business-hours");
            const { data: hours, error: hoursError } = await supabaseAdmin
              .from("phone_numbers")
              .select(
                "business_hours_enabled, business_timezone, business_hours, business_holidays, after_hours_route",
              )
              .eq("phone_number", appNumber)
              .maybeSingle();
            if (!hoursError && hours) {
              hoursRoute = routeForHours({
                enabled: Boolean(hours.business_hours_enabled),
                timeZone: hours.business_timezone || "America/Chicago",
                schedule: parseWeeklySchedule(hours.business_hours),
                holidays: parseHolidayDates(hours.business_holidays),
                afterHours: hours.after_hours_route === "voicemail" ? "voicemail" : "ai",
                now: new Date(),
              });
            }
          } catch {
            hoursRoute = "as_today";
          }

          if (hoursRoute === "after_hours_voicemail" || hoursRoute === "after_hours_ai") {
            const answer =
              hoursRoute === "after_hours_voicemail"
                ? await classicVoicemailTwiml(supabaseAdmin as never, number ?? {})
                : await voicemailTwiml(supabaseAdmin as never, number ?? {}, {
                    callSid: get("CallSid"),
                    from: get("From"),
                    appNumber,
                  });
            const handOff = answer.startsWith("<Redirect");
            try {
              await supabaseAdmin
                .from("calls")
                .update({
                  answer_path: handOff ? "ai_agent" : "voicemail",
                })
                .eq("sid", get("CallSid"));
            } catch {
              // bookkeeping only
            }
            return xml(ringbackTwiml() + answer);
          }

          // Open hours: ring present in-app clients, then the owner's cell, then
          // the AI or voicemail. After-hours already returned above.
          const { loadInboundRing } = await import("@/lib/ring-targets.server");
          const { chooseInboundAnswer } = await import("@/lib/inbound-ring");
          const ring = await loadInboundRing(supabaseAdmin as never, {
            appNumber,
            aiEnabled: Boolean(aiAnswering),
            forwardTo: (number?.forward_to as string | null) ?? null,
          });
          const choice = chooseInboundAnswer(ring);
          const caller = get("From").replace(/^whatsapp:/, "") || appNumber;

          const stampAnswer = async (answerPath: string) => {
            try {
              await supabaseAdmin
                .from("calls")
                .update({ answer_path: answerPath })
                .eq("sid", get("CallSid"));
            } catch {
              // bookkeeping only
            }
          };

          switch (choice.kind) {
            case "clients":
              await stampAnswer("in_app");
              return xml(
                inboundClientDialTwiml({
                  record: recordCalls,
                  callerId: caller,
                  timeoutSeconds: RING_SECONDS,
                  actionUrl: inboundRingActionUrl("clients"),
                  clientIdentities: choice.identities,
                }),
              );
            case "owner_cell":
              await stampAnswer("owner_cell");
              return xml(
                forwardedCallTwiml({
                  record: recordCalls,
                  callerId: appNumber,
                  destination: choice.cell,
                  timeoutSeconds: RING_SECONDS,
                  actionUrl: inboundRingActionUrl("owner_cell"),
                }),
              );
            case "ai": {
              const answer = await voicemailTwiml(
                supabaseAdmin as never,
                { ...(number ?? {}), record_calls: recordCalls },
                {
                  callSid: get("CallSid"),
                  from: get("From"),
                  appNumber,
                },
              );

              // Callers always hear four rings first — including before the AI
              // hand-off, which would otherwise pick up instantly. Voicemail
              // recording, when used, speaks the notice inside the answer TwiML.
              const handOff = answer.includes("<Redirect");
              const twiml = ringbackTwiml() + answer;
              await stampAnswer(handOff ? "ai_agent" : (number?.answer_mode ?? "voicemail"));
              return xml(twiml);
            }
            default: {
              const _exhaustive: never = choice;
              return _exhaustive;
            }
          }
        } catch (error) {
          console.error(`Inbound voice handler failed for ${appNumber}:`, error);
          try {
            const { logWebhookError } = await import("@/lib/webhook-errors.server");
            await logWebhookError(supabaseAdmin as never, {
              source: "voice",
              message: error instanceof Error ? error.message : String(error),
              url: url.toString(),
              callSid: get("CallSid"),
              appNumber,
            });
          } catch {
            // never block the fallback
          }
          const { fallbackVoicemailTwiml } = await import("@/lib/voice-answer.server");
          return xml(fallbackVoicemailTwiml());
        }
      },
    },
  },
});
