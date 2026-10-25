import { createFileRoute } from "@tanstack/react-router";
import { clawChannel, clawMessageSchema, extractToken, tokenMatches } from "@/lib/claw-inbound";

/**
 * Claw Messenger managed webhook: iMessage / RCS replies land in the SixVox inbox.
 * Auth: shared CLAW_WEBHOOK_TOKEN. Replies thread under CLAW_HOME_NUMBER (a SixVox line).
 */
export const Route = createFileRoute("/api/public/claw/inbound")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        if (!tokenMatches(extractToken(request), process.env["CLAW_WEBHOOK_TOKEN"])) {
          return Response.json({ error: "unauthorized" }, { status: 401 });
        }
        let raw: unknown;
        try {
          raw = await request.json();
        } catch {
          return Response.json({ error: "invalid json" }, { status: 400 });
        }
        if ((raw as { type?: string })?.type && (raw as { type?: string }).type !== "message") {
          return Response.json({ ok: true, ignored: true });
        }
        const parsed = clawMessageSchema.safeParse(raw);
        if (!parsed.success) return Response.json({ error: "invalid payload" }, { status: 400 });
        const msg = parsed.data;

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { logWebhookError } = await import("@/lib/webhook-errors.server");
        const appNumber = process.env["CLAW_HOME_NUMBER"]?.trim() || "";
        try {
          const { resolveWorkspaceIdForNumber } = await import("@/lib/workspace.server");
          const home = appNumber ? await resolveWorkspaceIdForNumber(appNumber) : { workspaceId: null };
          if (!home.workspaceId) {
            await logWebhookError(supabaseAdmin as never, {
              source: "claw",
              message: appNumber ? "no workspace for Claw home number" : "CLAW_HOME_NUMBER not set",
              appNumber: appNumber || null,
            });
            return Response.json({ ok: true });
          }
          const sid = `claw:${msg.messageId}`;
          const { data: dupe } = await supabaseAdmin.from("messages").select("id").eq("sid", sid).maybeSingle();
          if (dupe) return Response.json({ ok: true, duplicate: true });

          const { upsertConversation } = await import("@/lib/app.server");
          // Same thread as SMS with this contact; the message row carries the real channel.
          const conversationId = await upsertConversation(supabaseAdmin as never, {
            channel: "sms",
            appNumber,
            contactNumber: msg.from,
            workspaceId: home.workspaceId,
          });
          const channel = clawChannel(msg.service);
          const media = msg.attachments.map((a) => ({ url: a.url, contentType: a.mimeType ?? "" }));
          const { error } = await supabaseAdmin.from("messages").insert({
            conversation_id: conversationId,
            sid,
            direction: "inbound",
            channel,
            from_number: msg.from,
            to_number: appNumber,
            body: msg.text,
            media,
            status: "received",
            workspace_id: home.workspaceId,
          } as never);
          if (error) throw new Error(error.message);

          const { data: convo } = await supabaseAdmin
            .from("conversations").select("unread_count").eq("id", conversationId).maybeSingle();
          await supabaseAdmin.from("conversations").update({
            last_message_at: new Date().toISOString(),
            last_message_preview: msg.text ? msg.text.slice(0, 140) : "[media]",
            unread_count: (convo?.unread_count ?? 0) + 1,
            archived: false,
          }).eq("id", conversationId);

          const { notifyNumber } = await import("@/lib/notify.server");
          await notifyNumber(supabaseAdmin as never, appNumber, {
            push: {
              title: `${channel === "rcs" ? "RCS" : channel === "sms" ? "SMS" : "iMessage"} from ${msg.from}`,
              body: msg.text ? msg.text.slice(0, 180) : "Sent an attachment",
              url: `/inbox/${conversationId}`,
              tag: `conversation-${conversationId}`,
            },
          } as never);
          return Response.json({ ok: true });
        } catch (error) {
          console.error("claw inbound failed", error);
          await logWebhookError(supabaseAdmin as never, {
            source: "claw",
            message: error instanceof Error ? error.message : String(error),
            appNumber: appNumber || null,
          });
          return Response.json({ error: "failed" }, { status: 500 });
        }
      },
    },
  },
});
