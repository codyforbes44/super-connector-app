import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { OutboundEventType } from "@/lib/outbound-webhooks";
import * as ops from "@/lib/webhook-settings.server";

export const listWebhookSettings = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => ops.listWebhookSettings(context.supabase, context.userId));

export const createWebhookEndpoint = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { url: string; events: string[]; description?: string | null }) => input)
  .handler(async ({ context, data }) =>
    ops.createWebhookEndpoint(context.supabase, context.userId, data),
  );

export const updateWebhookEndpoint = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: {
      id: string;
      url?: string;
      events?: string[];
      enabled?: boolean;
      description?: string | null;
    }) => input,
  )
  .handler(async ({ context, data }) =>
    ops.updateWebhookEndpoint(context.supabase, context.userId, data),
  );

export const rotateWebhookSecret = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string }) => input)
  .handler(async ({ context, data }) =>
    ops.rotateWebhookSecret(context.supabase, context.userId, data.id),
  );

export const deleteWebhookEndpoint = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string }) => input)
  .handler(async ({ context, data }) =>
    ops.deleteWebhookEndpoint(context.supabase, context.userId, data.id),
  );

export const resendWebhookDelivery = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { deliveryId: string }) => input)
  .handler(async ({ context, data }) =>
    ops.resendWebhookDelivery(context.supabase, context.userId, data.deliveryId),
  );

export const sendWebhookTest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { endpointId: string; type: OutboundEventType }) => input)
  .handler(async ({ context, data }) =>
    ops.sendWebhookTest(context.supabase, context.userId, data),
  );
