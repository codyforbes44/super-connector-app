import { createFileRoute } from "@tanstack/react-router";

import { canPlaceOutboundAppCall } from "@/lib/app-voice-auth";

function xml(body: string) {
  return new Response(`<?xml version="1.0" encoding="UTF-8"?><Response>${body}</Response>`, {
    headers: { "Content-Type": "text/xml" },
  });
}

function esc(value: string) {
  return value.replace(
    /[<>&'"]/g,
    (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", "'": "&apos;", '"': "&quot;" })[c] as string,
  );
}

export const Route = createFileRoute("/api/public/twilio/app-voice")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const url = new URL(request.url);
        const statusUrl = `${url.origin}${url.pathname.replace("/app-voice", "/status")}${url.search}`;

        const { verifyTwilioWebhook, rejectWebhook } =
          await import("@/lib/twilio-signature.server");
        const auth = await verifyTwilioWebhook(request);
        if (!auth.ok) return rejectWebhook(request, auth.reason, auth.params);

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

          const { data: owned } = await supabaseAdmin
            .from("phone_numbers")
            .select("phone_number, assigned_to, outbound_caller_id")
            .eq("phone_number", callerId)
            .maybeSingle();
          // Service-role requests have no logged-in user, and the database admin
          // helper requires that user to match, so it cannot be used here.
          const { data: roleRows, error: roleError } = await supabaseAdmin
            .from("user_roles")
            .select("role")
            .eq("user_id", userId);
          if (roleError) {
            console.error("Outbound role lookup failed", roleError);
            return xml(`<Say voice="alice">This call could not be placed.</Say>`);
          }
          const permitted = canPlaceOutboundAppCall({
            numberOnAccount: Boolean(owned),
            assignedTo: (owned?.assigned_to as string | null) ?? null,
            userId,
            roles: (roleRows ?? []).map((row) => String(row.role)),
          });
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
            // This outbound leg is not recorded. Inbound voicemail uses recordVerb,
            // which speaks the recording notice before Twilio starts the recording.
            `<Dial callerId="${esc(presentedId)}" answerOnBridge="true" action="${esc(statusUrl)}"><Number>${esc(to)}</Number></Dial>`,
          );
        }

        /* --------------------------------------------------- inbound: PSTN leg */
        const appNumber = get("To").replace(/^whatsapp:/, "");

        // Which pass of the in-app ring this is. Twilio comes back here through
        // the <Dial action> once each attempt finishes.
        const stage = url.searchParams.get("stage");
        const stageUrl = (next: string) => {
          const u = new URL(url.toString());
          u.searchParams.set("stage", next);
          return u.toString();
        };

        // Someone answered in the app and the call has since ended.
        const dialStatus = get("DialCallStatus");
        if (stage && (dialStatus === "completed" || dialStatus === "answered")) {
          return xml("<Hangup />");
        }

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
        const ringUserIds: string[] = [];
        if (number?.assigned_to) {
          ringUserIds.push(number.assigned_to as string);
        }

        // Owners and admins can access every workspace number in the app, so
        // they must remain eligible to answer even when a number is assigned
        // to one specific teammate.
        const { data: admins } = await supabaseAdmin
          .from("user_roles")
          .select("user_id")
          .in("role", ["owner", "admin"]);
        for (const row of admins ?? []) {
          const userId = row.user_id as string;
          if (!ringUserIds.includes(userId)) {
            ringUserIds.push(userId);
          }
        }
        const identities = ringUserIds.map(voiceIdentityFor);

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

        const { voicemailTwiml, ringbackTwiml, RING_SECONDS, RINGBACK_CYCLE_SECONDS } =
          await import("@/lib/voice-answer.server");
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
        if (!stage) {
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
        }

        if (identities.length === 0) {
          const forwarding = Boolean(number?.forward_to) && !aiAnswering;
          return xml(forwarding ? fallback : ringbackTwiml() + fallback);
        }

        const clients = identities
          .slice(0, 10)
          .map((identity) => `<Client>${esc(identity)}</Client>`)
          .join("");

        const dialClients = (timeout: number, nextStage: string) =>
          `<Dial callerId="${esc(from)}" timeout="${timeout}" ringTone="us" answerOnBridge="true" action="${esc(stageUrl(nextStage))}" method="POST">${clients}</Dial>`;

        // Native ring fallback. Off unless MOBILE_PSTN_FALLBACK is set, so this
        // returns the same TwiML as before until the owner turns it on.
        const { planPstnFallback, pstnFallbackEnabled, ACK_STAGE } =
          await import("@/lib/mobile-ring");
        const fallbackEnabled = pstnFallbackEnabled();
        let acked: boolean | null = null;
        let ownerCell: string | null = null;
        if (fallbackEnabled && stage === ACK_STAGE) {
          const { inboundDeviceAcked, ownerCellForNumber } =
            await import("@/lib/mobile-ring.server");
          acked = await inboundDeviceAcked(supabaseAdmin, callSid);
          if (acked === false) {
            ownerCell = await ownerCellForNumber(supabaseAdmin, {
              assignedTo: (number?.assigned_to as string | null) ?? null,
            });
          }
        }
        const pstnPlan = planPstnFallback({
          enabled: fallbackEnabled,
          stage,
          ringSeconds: RING_SECONDS,
          acked,
          ownerCell,
          caller: from,
        });
        switch (pstnPlan.action) {
          case "clients":
            return xml(dialClients(pstnPlan.timeout, pstnPlan.nextStage));
          case "clients-and-cell":
            return xml(
              `<Dial callerId="${esc(appNumber)}" timeout="${pstnPlan.timeout}" ringTone="us" answerOnBridge="true" action="${esc(stageUrl(pstnPlan.nextStage))}" method="POST">${clients}<Number>${esc(pstnPlan.cell)}</Number></Dial>`,
            );
          case "skip":
            break;
          default: {
            const _exhaustive: never = pstnPlan;
            return _exhaustive;
          }
        }

        // First pass: ring every signed-in device.
        if (!stage) return xml(dialClients(RING_SECONDS, "after-dial"));

        // Twilio fails a call to a device that is not currently connected in a
        // split second, so the caller would hear the AI answer instantly. When
        // that happens, ring the caller for real while the wake-up alert brings
        // the app online, then try the app once more before anything else.
        if (stage === "after-dial") {
          let elapsed = RING_SECONDS;
          try {
            const { data: row } = await supabaseAdmin
              .from("calls")
              .select("created_at")
              .eq("sid", callSid)
              .maybeSingle();
            const startedAt = row?.created_at ? Date.parse(row.created_at as string) : NaN;
            if (!Number.isNaN(startedAt)) elapsed = (Date.now() - startedAt) / 1000;
          } catch {
            // fall through to the normal fallback
          }
          if (elapsed < RING_SECONDS - 4) {
            return xml(
              ringbackTwiml(RINGBACK_CYCLE_SECONDS * 2) + dialClients(RING_SECONDS, "retry-done"),
            );
          }
        }

        return xml(fallback);
      },
    },
  },
});
