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

        const { loadInboundRing } = await import("@/lib/ring-targets.server");
        const ring = await loadInboundRing(supabaseAdmin as never, {
          appNumber,
          aiEnabled: Boolean(number?.answer_mode === "ai_agent" && number?.elevenlabs_agent_id),
          forwardTo: (number?.forward_to as string | null) ?? null,
        });
        const ringUserIds = ring.userIds;
        const identities = ring.identities;
        if (ring.workspaceId) {
          await supabaseAdmin
            .from("calls")
            .update({ workspace_id: ring.workspaceId })
            .eq("sid", callSid);
        }

        // Wake the devices we are actually going to ring.
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
        const aiConfigured = Boolean(
          number?.answer_mode === "ai_agent" && number?.elevenlabs_agent_id,
        );
        let aiAllowed = aiConfigured;
        if (aiConfigured && ring.workspaceId) {
          const { assertCanStartAiCall } = await import("@/lib/entitlements.server");
          aiAllowed = await assertCanStartAiCall(ring.workspaceId);
        }
        const terminalConfig = aiAllowed
          ? (number ?? {})
          : { ...(number ?? {}), answer_mode: "voicemail", elevenlabs_agent_id: null };
        const terminal = await voicemailTwiml(supabaseAdmin as never, terminalConfig, {
          callSid,
          from,
          appNumber,
        });
        const handOff = aiAllowed && terminal.startsWith("<Redirect");
        if (handOff && ring.workspaceId && !stage) {
          const { recordAiCall } = await import("@/lib/entitlements.server");
          await recordAiCall(ring.workspaceId);
        }

        const ownerCell = ring.ownerCell;
        const ownerDial = ownerCell
          ? `<Dial callerId="${esc(appNumber)}" timeout="${RING_SECONDS}" ringTone="us" action="${esc(stageUrl("after-cell"))}" method="POST"><Number>${esc(ownerCell)}</Number></Dial>`
          : null;
        const fallback = ownerDial ?? terminal;

        if (stage === "after-cell") return xml(terminal);

        // In-app devices first, then the owner's cell, then AI or voicemail.
        if (!stage) {
          try {
            await supabaseAdmin
              .from("calls")
              .update({
                answer_path: identities.length
                  ? "in_app"
                  : ownerCell
                    ? "owner_cell"
                    : handOff
                      ? "ai_agent"
                      : "voicemail",
              })
              .eq("sid", callSid);
          } catch {
            // bookkeeping only
          }
        }

        if (identities.length === 0) {
          return xml(ownerDial ? ownerDial : ringbackTwiml() + terminal);
        }

        const clients = identities
          .slice(0, 10)
          .map((identity) => `<Client>${esc(identity)}</Client>`)
          .join("");

        const dialClients = (timeout: number, nextStage: string) =>
          `<Dial callerId="${esc(from)}" timeout="${timeout}" ringTone="us" answerOnBridge="true" action="${esc(stageUrl(nextStage))}" method="POST">${clients}</Dial>`;

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
