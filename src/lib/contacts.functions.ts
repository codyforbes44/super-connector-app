import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import * as ops from "./contacts.server";

export const listContacts = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { search?: string }) => input)
  .handler(async ({ context, data }) =>
    ops.listContacts(context.supabase, context.userId, data.search),
  );

export const saveContact = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: ops.ContactInput) => input)
  .handler(async ({ context, data }) => ops.upsertContact(context.supabase, context.userId, data));

export const removeContact = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string }) => input)
  .handler(async ({ context, data }) =>
    ops.deleteContact(context.supabase, context.userId, data.id),
  );

export const importDeviceContacts = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { entries: ops.ContactInput[] }) => input)
  .handler(async ({ context, data }) =>
    ops.importContacts(context.supabase, context.userId, data.entries ?? []),
  );
