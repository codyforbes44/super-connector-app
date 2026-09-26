import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/twilio/sms")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { verifyTwilioWebhook, rejectWebhook } = await import("@/lib/twilio-signature.server");
        const auth = await verifyTwilioWebhook(request);
        if (!auth.ok) return rejectWebhook(request, auth.reason, auth.params);

        const get = (key: string) => auth.params[key] ?? "";
        const strip = (value: string) => value.replace(/^whatsapp:/, "");

        const rawFrom = get("From");
        const rawTo = get("To");
        const channel = rawFrom.startsWith("whatsapp:") ? "whatsapp" : "sms";
        const appNumber = strip(rawTo);
        const contactNumber = strip(rawFrom);

        const media: Array<{ url: string; contentType: string }> = [];
        const numMedia = Number(get("NumMedia") || "0");
        for (let i = 0; i < numMedia; i += 1) {
          media.push({
            url: get(`MediaUrl${i}`),
            contentType: get(`MediaContentType${i}`),
          });
        }

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { upsertConversation } = await import("@/lib/app.server");

        const conversationId = await upsertConversation(supabaseAdmin as never, {
          channel,
          appNumber,
          contactNumber,
        });

        const body = get("Body");
        await supabaseAdmin.from("messages").insert({
          conversation_id: conversationId,
          sid: get("MessageSid") || get("SmsSid") || null,
          direction: "inbound",
          channel,
          from_number: contactNumber,
          to_number: appNumber,
          body,
          media,
          status: "received",
        });

        // Carrier-standard STOP/START keywords gate every future send.
        const { optOutSignal } = await import("@/lib/messaging.server");
        const signal = optOutSignal(body ?? "");
        if (signal) {
          await supabaseAdmin
            .from("conversations")
            .update({
              opted_out: signal === "stop",
              opted_out_at: signal === "stop" ? new Date().toISOString() : null,
            })
            .eq("id", conversationId);
        }

        const { data: convo } = await supabaseAdmin
          .from("conversations")
          .select("unread_count")
          .eq("id", conversationId)
          .maybeSingle();

        await supabaseAdmin
          .from("conversations")
          .update({
            last_message_at: new Date().toISOString(),
            last_message_preview: body ? body.slice(0, 140) : "[media]",
            unread_count: (convo?.unread_count ?? 0) + 1,
            archived: false,
          })
          .eq("id", conversationId);

        const { notifyNumber } = await import("@/lib/notify.server");
        const { inboundMessage } = await import("@/lib/email-templates/index");
        await notifyNumber(supabaseAdmin as never, appNumber, {
          push: {
            title: `${channel === "whatsapp" ? "WhatsApp" : "SMS"} from ${contactNumber}`,
            body: body ? body.slice(0, 180) : "Sent an attachment",
            url: `/inbox/${conversationId}`,
            tag: `conversation-${conversationId}`,
          },
          email: {
            prefKey: "email_inbound_message",
            template: "inbound-message",
            render: (baseUrl) =>
              inboundMessage({
                baseUrl,
                channel,
                from: contactNumber,
                to: appNumber,
                at: new Date().toUTCString(),
                preview: body ?? "",
                conversationId,
                mediaCount: Array.isArray(media) ? media.length : 0,
              }),
            context: { conversationId, channel },
          },
        });

        return new Response('<?xml version="1.0" encoding="UTF-8"?><Response></Response>', {
          headers: { "Content-Type": "text/xml" },
        });
      },
    },
  },
});