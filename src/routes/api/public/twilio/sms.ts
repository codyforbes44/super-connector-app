import { createFileRoute } from "@tanstack/react-router";

function unauthorized() {
  return new Response("Unauthorized", { status: 401 });
}

export const Route = createFileRoute("/api/public/twilio/sms")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const url = new URL(request.url);
        const expected = process.env["TWILIO_WEBHOOK_TOKEN"];
        if (!expected || url.searchParams.get("t") !== expected) return unauthorized();

        const form = await request.formData();
        const get = (key: string) => (form.get(key) as string | null) ?? "";
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

        const { notifyNumberWatchers } = await import("@/lib/push.server");
        await notifyNumberWatchers(supabaseAdmin as never, appNumber, {
          title: `${channel === "whatsapp" ? "WhatsApp" : "SMS"} from ${contactNumber}`,
          body: body ? body.slice(0, 180) : "Sent an attachment",
          url: `/inbox/${conversationId}`,
          tag: `conversation-${conversationId}`,
        });

        return new Response('<?xml version="1.0" encoding="UTF-8"?><Response></Response>', {
          headers: { "Content-Type": "text/xml" },
        });
      },
    },
  },
});