/**
 * Fans receptionist events out through the signed outbound webhook sender.
 * Manual bookings and website enquiries publish on their own paths.
 */

import { supabaseAdmin } from "@/integrations/supabase/client.server";

import { onAppEvent, type AppEvent } from "./app-events";
import { publishOutboundEvent } from "./outbound-webhooks.server";

let wired = false;

function payloadFor(event: AppEvent): { eventId: string; data: Record<string, unknown> } {
  switch (event.type) {
    case "booking.created":
      return {
        eventId: `booking.created:${event.payload.bookingId}`,
        data: {
          event_id: event.payload.bookingId,
          app_number: event.payload.appNumber,
          summary: event.payload.summary,
          starts_at: event.payload.startsAt,
          ends_at: event.payload.endsAt,
          contact_number: event.payload.contactNumber,
          call_sid: event.payload.callSid,
        },
      };
    case "lead.captured":
      return {
        eventId: `lead.captured:${event.payload.callSid}`,
        data: {
          name: event.payload.name,
          callback_number: event.payload.callbackNumber,
          address: event.payload.address,
          job_type: event.payload.jobType,
          urgency: event.payload.urgency,
          app_number: event.payload.appNumber,
          contact_number: event.payload.contactNumber,
          call_sid: event.payload.callSid,
          source: "call",
        },
      };
    default: {
      const neverEvent: never = event;
      return neverEvent;
    }
  }
}

export function wireAppEventWebhooks(): void {
  if (wired) return;
  wired = true;
  onAppEvent(async (event) => {
    const body = payloadFor(event);
    await publishOutboundEvent(supabaseAdmin, {
      type: event.type,
      eventId: body.eventId,
      workspaceId: event.payload.workspaceId,
      data: body.data,
    });
  });
}
