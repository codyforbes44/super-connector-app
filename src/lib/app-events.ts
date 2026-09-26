/**
 * In-process events for other SixVox work to hook.
 * Phase 4d signed webhooks should subscribe with `onAppEvent` and fan out
 * `booking.created` and `lead.captured`. This module does not deliver HTTP.
 */

export type BookingCreatedPayload = {
  bookingId: string;
  appNumber: string;
  contactNumber: string | null;
  startsAt: string;
  endsAt: string;
  summary: string;
  workspaceId: string | null;
  callSid: string | null;
};

export type LeadCapturedPayload = {
  callSid: string;
  appNumber: string | null;
  contactNumber: string | null;
  name: string | null;
  callbackNumber: string | null;
  address: string | null;
  jobType: string | null;
  urgency: string | null;
  workspaceId: string | null;
};

export type AppEvent =
  | { type: "booking.created"; payload: BookingCreatedPayload }
  | { type: "lead.captured"; payload: LeadCapturedPayload };

type Handler = (event: AppEvent) => void | Promise<void>;

const handlers: Handler[] = [];

export function onAppEvent(handler: Handler): () => void {
  handlers.push(handler);
  return () => {
    const index = handlers.indexOf(handler);
    if (index >= 0) handlers.splice(index, 1);
  };
}

export async function emitAppEvent(event: AppEvent): Promise<void> {
  for (const handler of [...handlers]) {
    try {
      await handler(event);
    } catch (error) {
      console.error(`app event ${event.type} handler failed`, error);
    }
  }
}
