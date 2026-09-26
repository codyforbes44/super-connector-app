import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { MAX_IMPORT_CHARS, type ImportHint } from "./contact-import";
import * as ops from "./contacts.server";

const IMPORT_HINTS = new Set<ImportHint>(["auto", "csv", "vcard", "paste"]);

function importRequest(input: { text?: unknown; hint?: unknown } | null) {
  if (!input || typeof input.text !== "string" || !input.text.trim()) {
    throw new Error("Paste or upload a contact list first.");
  }
  if (input.text.length > MAX_IMPORT_CHARS) {
    throw new Error("That list is too large. Keep it under 2,000 contacts.");
  }
  const hint = input.hint ?? "auto";
  if (typeof hint !== "string" || !IMPORT_HINTS.has(hint as ImportHint)) {
    throw new Error("That import format isn't supported.");
  }
  return { text: input.text, hint: hint as ImportHint };
}

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

export const previewContactImport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(importRequest)
  .handler(async ({ context, data }) =>
    ops.previewContactImport(context.supabase, context.userId, data.text, data.hint),
  );

export const commitContactImport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(importRequest)
  .handler(async ({ context, data }) =>
    ops.commitContactImport(context.supabase, context.userId, data.text, data.hint),
  );
