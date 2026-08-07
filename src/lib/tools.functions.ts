import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import * as ops from "./tools-ops.server";


/* places */

export const quickPlaces = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { query: string }) => input)
  .handler(async ({ context, data }) =>
    ops.fastPlaces(context.supabase, context.userId, data.query),
  );

export const recentPlaceSearches = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => ops.recentSearches(context.supabase, context.userId));

export const listFavoritePlaces = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => ops.listSavedPlaces(context.supabase, context.userId));

export const saveFavoritePlace = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: ops.SavedPlaceInput) => input)
  .handler(async ({ context, data }) =>
    ops.saveFavoritePlace(context.supabase, context.userId, data),
  );

export const removeFavoritePlace = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string }) => input)
  .handler(async ({ context, data }) =>
    ops.deleteFavoritePlace(context.supabase, context.userId, data.id),
  );

/* email analytics */

export const listEmailDeliveries = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { status?: string; recipient?: string; limit?: number }) => input)
  .handler(async ({ context, data }) =>
    ops.emailDeliveries(context.supabase, context.userId, data),
  );

export const getEmailDetail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string }) => input)
  .handler(async ({ context, data }) => ops.emailDetail(context.supabase, context.userId, data.id));

export const retryEmailDelivery = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string }) => input)
  .handler(async ({ context, data }) => ops.retryEmail(context.supabase, context.userId, data.id));

/* templates */

export const listEmailTemplates = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => ops.listTemplateOverrides(context.supabase, context.userId));

export const saveEmailTemplate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: {
      template: string;
      subject?: string | null;
      eyebrow?: string | null;
      headline?: string | null;
      intro?: string | null;
      outro?: string | null;
      enabled: boolean;
    }) => input,
  )
  .handler(async ({ context, data }) =>
    ops.saveTemplateOverride(context.supabase, context.userId, data),
  );

export const previewEmailTemplate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: {
      template: string;
      draft: {
        subject?: string | null;
        eyebrow?: string | null;
        headline?: string | null;
        intro?: string | null;
        outro?: string | null;
        enabled: boolean;
      };
    }) => input,
  )
  .handler(async ({ context, data }) =>
    ops.previewTemplate(context.supabase, context.userId, data),
  );

/* calendar settings */

export const getCalendarSyncSettings = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => ops.getCalendarSettings(context.supabase, context.userId));

export const saveCalendarSyncSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: ops.CalendarSettingsInput) => input)
  .handler(async ({ context, data }) =>
    ops.saveCalendarSettings(context.supabase, context.userId, data),
  );