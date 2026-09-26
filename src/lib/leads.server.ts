import { BRAND, escapeHtml, layout, metaTable, paragraph, quote } from "./email-templates/layout";
import { FROM_ACCOUNT, emailConfigured, sendEmail } from "./email.server";
import { publishOutboundEvent } from "./outbound-webhooks.server";

const NOTIFY_TO = "codyforbes@gmail.com";

export type LeadInput = {
  name: string;
  email: string;
  company: string;
  message: string;
};

export async function recordLead(lead: LeadInput): Promise<{ ok: true }> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  const { data: inserted } = await supabaseAdmin
    .from("leads")
    .insert({
      name: lead.name,
      email: lead.email,
      company: lead.company || null,
      message: lead.message,
      source: "contact",
    })
    .select("id")
    .maybeSingle();

  try {
    await publishOutboundEvent(supabaseAdmin, {
      type: "lead.captured",
      eventId: `lead.captured:${inserted?.id ?? lead.email}`,
      workspaceId: null,
      data: {
        name: lead.name,
        email: lead.email,
        company: lead.company,
        message: lead.message,
        source: "contact",
      },
    });
  } catch (error) {
    console.error("lead webhook publish failed", error);
  }

  if (emailConfigured()) {
    const body =
      paragraph(
        `<strong>${escapeHtml(lead.name)}</strong> reached out through the SixVox website.`,
      ) +
      metaTable([
        { label: "Name", value: lead.name },
        { label: "Email", value: lead.email },
        { label: "Company", value: lead.company },
      ]) +
      quote(escapeHtml(lead.message));

    await sendEmail(supabaseAdmin, {
      to: NOTIFY_TO,
      template: "account",
      from: FROM_ACCOUNT,
      replyTo: lead.email,
      rendered: {
        subject: `New SixVox enquiry — ${lead.name}`,
        html: layout({
          eyebrow: "Website",
          title: "New enquiry",
          preheader: `${lead.name} · ${lead.email}`,
          body,
        }),
      },
      context: { kind: "lead", email: lead.email, brand: BRAND.name },
    });
  }

  return { ok: true };
}