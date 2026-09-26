import type { SupabaseClient } from "@supabase/supabase-js";

import { emitAppEvent } from "./app-events";
import { wireAppEventWebhooks } from "./app-events-webhooks.server";

wireAppEventWebhooks();
import { extractLeadFields, mergeLeadFields, type LeadFields } from "./leads/extract";

export async function stampStructuredLead(
  admin: SupabaseClient,
  input: {
    callSid: string;
    appNumber: string | null;
    contactNumber: string | null;
    userId: string | null;
    workspaceId: string | null;
    transcript: string;
    entities?: Record<string, string>;
    modelUrgency?: string | null;
    overrides?: Partial<LeadFields>;
  },
): Promise<LeadFields | null> {
  if (!input.userId) return null;
  const extracted = extractLeadFields(input.transcript);
  const merged = mergeLeadFields(extracted, input.entities ?? {}, input.modelUrgency);
  const lead: LeadFields = {
    name: input.overrides?.name || merged.name,
    callbackNumber: input.overrides?.callbackNumber || merged.callbackNumber,
    address: input.overrides?.address || merged.address,
    jobType: input.overrides?.jobType || merged.jobType,
    urgency: input.overrides?.urgency || merged.urgency,
    tags: merged.tags,
  };

  let addressValid: boolean | null = null;
  if (lead.address) {
    try {
      const maps = await import("./maps.server");
      if (maps.mapsConfigured()) {
        const geo = await maps.geocode(lead.address);
        addressValid = Boolean(geo);
        if (geo) lead.address = geo.formatted;
      }
    } catch (error) {
      console.error("lead address validation failed", error);
      addressValid = false;
    }
  }

  await admin.from("call_intelligence").upsert(
    {
      user_id: input.userId,
      call_sid: input.callSid,
      app_number: input.appNumber,
      contact_number: input.contactNumber,
      lead_name: lead.name,
      lead_callback: lead.callbackNumber,
      lead_address: lead.address,
      lead_address_valid: addressValid,
      lead_job_type: lead.jobType,
      lead_urgency: lead.urgency,
      tags: lead.tags,
      ...(input.workspaceId ? { workspace_id: input.workspaceId } : {}),
    },
    { onConflict: "call_sid" },
  );

  if (lead.name || lead.address || lead.jobType) {
    await emitAppEvent({
      type: "lead.captured",
      payload: {
        callSid: input.callSid,
        appNumber: input.appNumber,
        contactNumber: input.contactNumber,
        name: lead.name,
        callbackNumber: lead.callbackNumber,
        address: lead.address,
        jobType: lead.jobType,
        urgency: lead.urgency,
        workspaceId: input.workspaceId,
      },
    });
  }

  return lead;
}
