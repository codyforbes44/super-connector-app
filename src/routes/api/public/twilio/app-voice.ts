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
            .select("phone_number, assigned_to")
            .eq("phone_number", callerId)
            .maybeSingle();
          const permitted = Boolean(owned) && (isAdmin === true || owned?.assigned_to === userId);
          if (!permitted) {
            console.warn(`Blocked client call from ${from} using caller ID ${callerId}`);
            return xml(`<Say voice="alice">You are not allowed to call from that number.</Say>`);
          }

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
            `<Dial callerId="${esc(callerId)}" answerOnBridge="true" record="record-from-answer-dual" recordingStatusCallback="${esc(statusUrl)}" action="${esc(statusUrl)}"><Number>${esc(to)}</Number></Dial>`,
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

        const { data: number } = await supabaseAdmin
          .from("phone_numbers")
          .select(
            "assigned_to, forward_to, voicemail_greeting, answer_mode, elevenlabs_agent_id, greeting_audio_path",
          )
          .eq("phone_number", appNumber)
          .maybeSingle();

        const { voiceIdentityFor } = await import("@/lib/voice-token.server");
        const identities: string[] = [];
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

        const { voicemailTwiml } = await import("@/lib/voice-answer.server");
        const unanswered = await voicemailTwiml(supabaseAdmin as never, number ?? {}, {
          callSid,
          from,
          appNumber,
        });
        const aiAnswering = number?.answer_mode === "ai_agent" && number?.elevenlabs_agent_id;

        const fallback =
          number?.forward_to && !aiAnswering
            ? `<Dial callerId="${esc(appNumber)}" timeout="20" record="record-from-answer-dual" recordingStatusCallback="${esc(statusUrl)}"><Number>${esc(number.forward_to as string)}</Number></Dial>`
            : unanswered;

        if (identities.length === 0) return xml(fallback);

        const clients = identities
          .slice(0, 10)
          .map((identity) => `<Client>${esc(identity)}</Client>`)
          .join("");

        return xml(
          `<Dial callerId="${esc(from)}" timeout="20" answerOnBridge="true" record="record-from-answer-dual" recordingStatusCallback="${esc(statusUrl)}">${clients}</Dial>${fallback}`,
        );
      },
    },
  },
});