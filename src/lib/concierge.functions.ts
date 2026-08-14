import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import * as admin from "./concierge/admin.server";

export const conciergeOverview = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => admin.overview(context.supabase, context.userId));

export const conciergeTranscript = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { conversationId: string }) => input)
  .handler(async ({ context, data }) =>
    admin.transcript(context.supabase, context.userId, data.conversationId),
  );

export const setConciergeLeadHandled = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string; handled: boolean }) => input)
  .handler(async ({ context, data }) =>
    admin.markLeadHandled(context.supabase, context.userId, data),
  );

export const setConciergeCallbackStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string; status: "pending" | "done" | "cancelled" }) => input)
  .handler(async ({ context, data }) =>
    admin.setCallbackStatus(context.supabase, context.userId, data),
  );

export const syncConcierge = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => admin.sync(context.supabase, context.userId));
