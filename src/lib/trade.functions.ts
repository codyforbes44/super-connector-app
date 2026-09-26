import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { PortDraft } from "./integrations/port-in";
import type { TradeCallFields } from "./integrations/trade.server";

export const getIntegrationsOverview = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { integrationsOverview } = await import("./integrations/trade.server");
    return integrationsOverview(context.supabase, context.userId);
  });

export const beginJobberConnect = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { absoluteUrl } = await import("./request-url.server");
    const { startJobberConnect } = await import("./integrations/trade.server");
    return startJobberConnect(context.userId, absoluteUrl("/oauth/jobber/return"));
  });

export const finishJobberConnect = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { code: string; state: string }) => input)
  .handler(async ({ context, data }) => {
    const { completeJobberConnect } = await import("./integrations/trade.server");
    return completeJobberConnect(context.userId, data.code, data.state);
  });

export const disconnectJobberAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { disconnectJobber } = await import("./integrations/trade.server");
    return disconnectJobber(context.userId);
  });

export const pushCallToJobber = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: TradeCallFields) => input)
  .handler(async ({ context, data }) => {
    const { syncJobber } = await import("./integrations/trade.server");
    return syncJobber(context.supabase, context.userId, data);
  });

export const saveHousecallApiKey = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { apiKey: string }) => input)
  .handler(async ({ context, data }) => {
    const { saveHousecallKey } = await import("./integrations/trade.server");
    return saveHousecallKey(context.userId, data.apiKey);
  });

export const disconnectHousecallAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { disconnectHousecall } = await import("./integrations/trade.server");
    return disconnectHousecall(context.userId);
  });

export const pushCallToHousecall = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: TradeCallFields) => input)
  .handler(async ({ context, data }) => {
    const { syncHousecall } = await import("./integrations/trade.server");
    return syncHousecall(context.supabase, context.userId, data);
  });

export const saveReviewRequestSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: {
      reviewUrl: string;
      businessName: string;
      enabled: boolean;
      cooldownDays: number;
      quietStart: string;
      quietEnd: string;
      timezone: string;
    }) => input,
  )
  .handler(async ({ context, data }) => {
    const { saveReviewSettings } = await import("./integrations/trade.server");
    return saveReviewSettings(context.userId, data);
  });

export const markJobDone = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { conversationId?: string; leadId?: string }) => input)
  .handler(async ({ context, data }) => {
    const ops = await import("./integrations/trade.server");
    return ops.markJobDone(context.supabase, context.userId, data);
  });

export const beginStripeConnect = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { absoluteUrl } = await import("./request-url.server");
    const { startConnectOnboarding } = await import("./integrations/trade.server");
    return startConnectOnboarding(context.supabase, context.userId, {
      returnUrl: absoluteUrl("/integrations?stripe=return"),
      refreshUrl: absoluteUrl("/integrations?stripe=refresh"),
    });
  });

export const refreshStripeConnect = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { refreshConnectStatus } = await import("./integrations/trade.server");
    return refreshConnectStatus(context.userId);
  });

export const sendPaymentLink = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { conversationId: string; amount: string; description: string }) => input)
  .handler(async ({ context, data }) => {
    const { createPaymentLink } = await import("./integrations/trade.server");
    return createPaymentLink(context.supabase, context.userId, data);
  });

export const savePortInDraft = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: { draft: PortDraft; bill: { filename: string; mime: string; base64: string } }) =>
      input,
  )
  .handler(async ({ context, data }) => {
    const { savePortDraft } = await import("./integrations/trade.server");
    return savePortDraft(context.userId, data.draft, data.bill);
  });

export const confirmPortInSubmit = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { portId: string; confirmed: boolean }) => input)
  .handler(async ({ context, data }) => {
    const { confirmPortIn } = await import("./integrations/trade.server");
    return confirmPortIn(context.userId, data.portId, data.confirmed);
  });
