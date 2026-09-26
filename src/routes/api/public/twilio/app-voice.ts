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
          const { userAcknowledgedE911 } = await import("@/lib/compliance/e911.server");
          const { outboundCallBlock, E911_BLOCK_SAY } = await import("@/lib/compliance/e911");
          let acknowledged = false;
          try {
            acknowledged = await userAcknowledgedE911(supabaseAdmin as never, userId);
          } catch (error) {
            console.error("E911 acknowledgment lookup failed", error);
          }
          if (outboundCallBlock(acknowledged)) {
            return xml(`<Say voice="alice">${esc(E911_BLOCK_SAY)}</Say>`);
          }
          // Contact override → routing rule → per-number caller ID → the number itself.
          const { resolveOutboundCallerId } = await import("@/lib/twilio-ops.server");
          const presentedId = await resolveOutboundCallerId(supabaseAdmin, callerId, to);

          const { resolveWorkspaceIdForNumber } = await import("@/lib/workspace.server");
          const { logWebhookError } = await import("@/lib/webhook-errors.server");
          try {
            const { workspaceId: outboundWorkspaceId } =
              await resolveWorkspaceIdForNumber(callerId);
            if (!outboundWorkspaceId) {
              await logWebhookError(supabaseAdmin as never, {
                source: "app-voice",
                message: "no workspace for outbound caller id",
                url: url.toString(),
                callSid,
                appNumber: callerId,
              });
            } else {
              const { error: callError } = await supabaseAdmin.from("calls").upsert(
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
                  workspace_id: outboundWorkspaceId,
                },
                { onConflict: "sid" },
              );
              if (callError) {
                await logWebhookError(supabaseAdmin as never, {
                  source: "app-voice",
                  message: callError.message,
                  url: url.toString(),
                  callSid,
                  appNumber: callerId,
                  workspaceId: outboundWorkspaceId,
                });
              }
            }
          } catch (error) {
            console.error("outbound call row failed", error);
            await logWebhookError(supabaseAdmin as never, {
              source: "app-voice",
              message: error instanceof Error ? error.message : String(error),
              url: url.toString(),
              callSid,
              appNumber: callerId,
            });
          }

          const { lineRecordsCalls } = await import("@/lib/compliance/recording.server");
          const { outboundAppDialTwiml } = await import("@/lib/voice-answer.server");
          const recordCalls = await lineRecordsCalls(supabaseAdmin as never, callerId);
          return xml(
            outboundAppDialTwiml({
              record: recordCalls,
              callerId: presentedId,
              destination: to,
              actionUrl: statusUrl,
            }),
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

        const { resolveWorkspaceIdForNumber } = await import("@/lib/workspace.server");
        const { logWebhookError } = await import("@/lib/webhook-errors.server");
        try {
          const { workspaceId: inboundWorkspaceId } = await resolveWorkspaceIdForNumber(appNumber);
          if (!inboundWorkspaceId) {
            await logWebhookError(supabaseAdmin as never, {
              source: "app-voice",
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
                from_number: from,
                to_number: get("To"),
                app_number: appNumber,
                status: get("CallStatus") || "ringing",
                workspace_id: inboundWorkspaceId,
              },
              { onConflict: "sid" },
            );
            if (callError) {
              await logWebhookError(supabaseAdmin as never, {
                source: "app-voice",
                message: callError.message,
                url: url.toString(),
                callSid,
                appNumber,
                workspaceId: inboundWorkspaceId,
              });
            }
          }
        } catch (error) {
          console.error("inbound call row failed", error);
          await logWebhookError(supabaseAdmin as never, {
            source: "app-voice",
            message: error instanceof Error ? error.message : String(error),
            url: url.toString(),
            callSid,
            appNumber,
          });
        }

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

        const {
          voicemailTwiml,
          ringbackTwiml,
          RING_SECONDS,
          RINGBACK_CYCLE_SECONDS,
          forwardedCallTwiml,
          inboundClientDialTwiml,
          liveRecordingPrefix,
          recordingNoticeWebhook,
          escapeXml,
        } = await import("@/lib/voice-answer.server");
        const { lineRecordsCalls } = await import("@/lib/compliance/recording.server");
        const recordCalls = await lineRecordsCalls(supabaseAdmin as never, appNumber);
        const aiConfigured = Boolean(
          number?.answer_mode === "ai_agent" && number?.elevenlabs_agent_id,
        );
        let aiAllowed = aiConfigured;
        if (aiConfigured && ring.workspaceId) {
          const { assertCanStartAiCall } = await import("@/lib/entitlements.server");
          aiAllowed = await assertCanStartAiCall(ring.workspaceId);
        }
        const voiceConfig = aiAllowed
          ? { ...(number ?? {}), record_calls: recordCalls }
          : {
              ...(number ?? {}),
              record_calls: recordCalls,
              answer_mode: "voicemail",
              elevenlabs_agent_id: null,
            };
        const unanswered = await voicemailTwiml(supabaseAdmin as never, voiceConfig, {
          callSid,
          from,
          appNumber,
        });
        const handOff = aiAllowed && unanswered.startsWith("<Redirect");
        if (handOff && ring.workspaceId && !stage) {
          const { recordAiCall } = await import("@/lib/entitlements.server");
          await recordAiCall(ring.workspaceId);
        }

        const aiAnswering = handOff;
        const ringOwnerCell = ring.ownerCell;
        const ownerDial = ringOwnerCell
          ? `<Dial callerId="${esc(appNumber)}" timeout="${RING_SECONDS}" ringTone="us" action="${esc(stageUrl("after-cell"))}" method="POST"><Number>${esc(ringOwnerCell)}</Number></Dial>`
          : null;
        const forwarded =
          number?.forward_to && !aiAnswering
            ? forwardedCallTwiml({
                record: recordCalls,
                callerId: appNumber,
                destination: number.forward_to as string,
                timeoutSeconds: RING_SECONDS,
              }) + unanswered
            : null;
        const fallback = forwarded ?? ownerDial ?? unanswered;

        if (stage === "after-cell") return xml(unanswered);
        if (!stage) {
          try {
            await supabaseAdmin
              .from("calls")
              .update({
                answer_path: identities.length
                  ? "in_app"
                  : forwarded
                    ? "forward"
                    : ringOwnerCell
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
          if (forwarded) return xml(forwarded);
          return xml(ownerDial ? ownerDial : ringbackTwiml() + unanswered);
        }

        const dialClients = (timeout: number, nextStage: string) =>
          inboundClientDialTwiml({
            record: recordCalls,
            callerId: from,
            timeoutSeconds: timeout,
            actionUrl: stageUrl(nextStage),
            clientIdentities: identities.slice(0, 10),
          });
        const noticeAttr = recordCalls
          ? ` url="${escapeXml(recordingNoticeWebhook())}" method="POST"`
          : "";
        const clients = identities
          .slice(0, 10)
          .map((identity) => `<Client${noticeAttr}>${esc(identity)}</Client>`)
          .join("");
        const recordPrefix = recordCalls ? liveRecordingPrefix() : "";

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
              `${recordPrefix}<Dial callerId="${esc(appNumber)}" timeout="${pstnPlan.timeout}" ringTone="us" answerOnBridge="true" action="${esc(stageUrl(pstnPlan.nextStage))}" method="POST">${clients}<Number${noticeAttr}>${esc(pstnPlan.cell)}</Number></Dial>`,
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
