import { createFileRoute } from "@tanstack/react-router";

function xml(body: string) {
  return new Response(`<?xml version="1.0" encoding="UTF-8"?><Response>${body}</Response>`, {
    headers: { "Content-Type": "text/xml" },
  });
}

function esc(value: string) {
  return value.replace(
    /[<>&'"]/g,
    (c) =>
      ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", "'": "&apos;", '"': "&quot;" })[c] as string,
  );
}

export const Route = createFileRoute("/api/public/twilio/app-voice")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const url = new URL(request.url);
        const statusUrl = `${url.origin}${url.pathname.replace("/app-voice", "/status")}${url.search}`;

        const { verifyTwilioWebhook, rejectWebhook } = await import(
          "@/lib/twilio-signature.server"
        );
        const auth = await verifyTwilioWebhook(request);
        if (!auth.ok) return rejectWebhook(request, auth.reason);

        const get = (key: string) => auth.params[key] ?? "";
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const from = get("From");
        const callSid = get("CallSid");

        /* ---------------------------------------- outbound: Twilio Client leg */
        if (from.startsWith("client:")) {
          const { userIdFromVoiceIdentity } = await import("@/lib/voice-token.server");
          const userId = userIdFromVoiceIdentity(from);
          const to = get("To") || get("Called");
          const callerId = get("CallerId") || get("callerId");

          if (!userId || !to || !callerId) {
            return xml(`<Say voice="alice">This call could not be placed.</Say>`);
          }

          const { data: isAdmin } = await supabaseAdmin.rpc("is_admin", { _user_id: userId });
          const { data: owned } = await supabaseAdmin
            .from("phone_numbers")
            .select("phone_number, assigned_to, outbound_caller_id")
            .eq("phone_number", callerId)
            .maybeSingle();
          const permitted = Boolean(owned) && (isAdmin === true || owned?.assigned_to === userId);
          if (!permitted) {
            console.warn(`Blocked client call from ${from} using caller ID ${callerId}`);
            return xml(`<Say voice="alice">You are not allowed to call from that number.</Say>`);
          }
          // Contact override → routing rule → per-number caller ID → the number itself.
          const { resolveOutboundCallerId } = await import("@/lib/twilio-ops.server");
          const presentedId = await resolveOutboundCallerId(supabaseAdmin, callerId, to);

          await supabaseAdmin.from("calls").upsert(
            {
              sid: callSid,
              direction: "outbound",
              from_number: callerId,
              to_number: to,
              app_number: callerId,
              status: "in-progress",
              client_identity: from.slice("client:".length),
              answered_in_app: true,
              answered_by: userId,
            },
            { onConflict: "sid" },
          );

          return xml(
            // Live two-party calls are never recorded — only voicemail is.
            `<Dial callerId="${esc(presentedId)}" answerOnBridge="true" action="${esc(statusUrl)}"><Number>${esc(to)}</Number></Dial>`,
          );
        }

        /* --------------------------------------------------- inbound: PSTN leg */
        const appNumber = get("To").replace(/^whatsapp:/, "");

        await supabaseAdmin.from("calls").upsert(
          {
            sid: callSid,
            direction: "inbound",
            from_number: from,
            to_number: get("To"),
            app_number: appNumber,
            status: get("CallStatus") || "ringing",
          },
          { onConflict: "sid" },
        );

        const { VOICE_CONFIG_COLUMNS } = await import("@/lib/voice-answer.server");
        // A line someone forwards their personal number to counts as verified
        // as soon as the first forwarded call lands here.
        try {
          const { noteForwardedCall } = await import("@/lib/byo.server");
          await noteForwardedCall(supabaseAdmin as never, appNumber);
        } catch {
          // forwarding bookkeeping must never break an inbound call
        }
        const { data: number } = await supabaseAdmin
          .from("phone_numbers")
          .select(`assigned_to, forward_to, ${VOICE_CONFIG_COLUMNS}`)
          .eq("phone_number", appNumber)
          .maybeSingle();

        const { voiceIdentityFor } = await import("@/lib/voice-token.server");
        let identities: string[] = [];
        const ringUserIds: string[] = [];
        if (number?.assigned_to) {
          identities.push(voiceIdentityFor(number.assigned_to as string));
          ringUserIds.push(number.assigned_to as string);
        } else {
          const { data: admins } = await supabaseAdmin
            .from("user_roles")
            .select("user_id")
            .in("role", ["owner", "admin"]);
          for (const row of admins ?? []) {
            const identity = voiceIdentityFor(row.user_id as string);
            if (!identities.includes(identity)) {
              identities.push(identity);
              ringUserIds.push(row.user_id as string);
            }
          }
        }

        // Always include assigned devices. Mobile browsers throttle heartbeat
        // timers in the background, so presence is advisory and must never
        // suppress the actual Twilio call invite. The Dial timeout already
        // provides the bounded four-ring fallback to voicemail or the agent.

        // Wake backgrounded devices so the incoming call can be answered in-app.
        if (ringUserIds.length) {
          const { sendPushToUsers } = await import("@/lib/push.server");
          await sendPushToUsers(supabaseAdmin as never, ringUserIds, {
            title: "Incoming call",
            body: `${from} → ${appNumber}`,
            url: `/calls?incoming=${encodeURIComponent(callSid)}`,
            tag: `ring-${callSid}`,
            type: "call",
            requireInteraction: true,
          });
        }

        const { voicemailTwiml, ringbackTwiml, RING_SECONDS } = await import(
          "@/lib/voice-answer.server"
        );
        const unanswered = await voicemailTwiml(supabaseAdmin as never, number ?? {}, {
          callSid,
          from,
          appNumber,
        });
        const aiAnswering = number?.answer_mode === "ai_agent" && number?.elevenlabs_agent_id;

        const fallback =
          number?.forward_to && !aiAnswering
            ? `<Dial callerId="${esc(appNumber)}" timeout="${RING_SECONDS}" ringTone="us"><Number>${esc(number.forward_to as string)}</Number></Dial>${unanswered}`
            : unanswered;

        // Let the caller hear four rings before voicemail or the AI answers.
        // Forwarding to another phone rings on its own, so it goes straight out.
        const handOff = unanswered.startsWith("<Redirect");
        try {
          await supabaseAdmin
            .from("calls")
            .update({
              answer_path: identities.length
                ? "in_app"
                : number?.forward_to && !aiAnswering
                  ? "forward"
                  : handOff
                    ? "ai_agent"
                    : (number?.answer_mode ?? "voicemail"),
            })
            .eq("sid", callSid);
        } catch {
          // bookkeeping only
        }

        if (identities.length === 0) {
          const forwarding = Boolean(number?.forward_to) && !aiAnswering;
          return xml(forwarding ? fallback : ringbackTwiml() + fallback);
        }

        const clients = identities
          .slice(0, 10)
          .map((identity) => `<Client>${esc(identity)}</Client>`)
          .join("");

        return xml(
          `<Dial callerId="${esc(from)}" timeout="${RING_SECONDS}" ringTone="us" answerOnBridge="true">${clients}</Dial>${fallback}`,
        );
      },
    },
  },
});