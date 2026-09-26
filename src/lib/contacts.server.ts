import type { SupabaseClient } from "@supabase/supabase-js";

import { normalizePhone } from "./twilio.server";

type SB = SupabaseClient;

export type ContactInput = {
  phoneNumber: string;
  name?: string | null;
  email?: string | null;
  address?: string | null;
  notes?: string | null;
};

function clean(value: string | null | undefined) {
  const trimmed = (value ?? "").trim();
  return trimmed.length ? trimmed : null;
}

export async function listContacts(supabase: SB, userId: string, search?: string) {
  let query = supabase
    .from("contacts")
    .select("*")
    .eq("owner_id", userId)
    .order("name", { nullsFirst: false })
    .limit(500);

  const term = clean(search);
  if (term)
    query = query.or(`name.ilike.%${term}%,phone_number.ilike.%${term}%,email.ilike.%${term}%`);

  const { data, error } = await query;
  if (error) throw error;
  return data ?? [];
}

export async function upsertContact(supabase: SB, userId: string, input: ContactInput) {
  const phone = normalizePhone(input.phoneNumber);
  if (!phone) throw new Error("A phone number is required.");

  const { resolveWorkspaceForUser } = await import("./workspace.server");
  const workspace = await resolveWorkspaceForUser(userId);
  if (!workspace) throw new Error("Create your workspace before saving contacts.");
  const patch: Record<string, unknown> = {
    owner_id: userId,
    phone_number: phone,
    name: clean(input.name),
    email: clean(input.email),
    address: clean(input.address),
    notes: clean(input.notes),
    workspace_id: workspace.id,
  };

  const { data: existing } = await supabase
    .from("contacts")
    .select("id")
    .eq("owner_id", userId)
    .eq("phone_number", phone)
    .maybeSingle();

  if (existing) {
    const { error } = await supabase.from("contacts").update(patch).eq("id", existing.id);
    if (error) throw error;
  } else {
    const { error } = await supabase.from("contacts").insert(patch);
    if (error) throw error;
  }

  const { data } = await supabase
    .from("contacts")
    .select("*")
    .eq("owner_id", userId)
    .eq("phone_number", phone)
    .maybeSingle();
  return data;
}

export async function deleteContact(supabase: SB, userId: string, id: string) {
  const { error } = await supabase.from("contacts").delete().eq("id", id).eq("owner_id", userId);
  if (error) throw error;
  return { ok: true };
}

/** Bulk merge from the device address book: adds new numbers, fills blank fields. */
export async function importContacts(supabase: SB, userId: string, entries: ContactInput[]) {
  const byPhone = new Map<string, ContactInput>();
  for (const entry of entries) {
    const phone = normalizePhone(entry.phoneNumber ?? "");
    if (!phone || phone.replace(/\D/g, "").length < 7) continue;
    const previous = byPhone.get(phone);
    byPhone.set(phone, {
      phoneNumber: phone,
      name: clean(entry.name) ?? previous?.name ?? null,
      email: clean(entry.email) ?? previous?.email ?? null,
      address: clean(entry.address) ?? previous?.address ?? null,
      notes: null,
    });
  }
  if (byPhone.size === 0) return { imported: 0, updated: 0, skipped: entries.length };

  const { resolveWorkspaceForUser } = await import("./workspace.server");
  const workspace = await resolveWorkspaceForUser(userId);
  if (!workspace) throw new Error("Create your workspace before saving contacts.");
  const phones = [...byPhone.keys()];
  const { data: existing } = await supabase
    .from("contacts")
    .select("id, phone_number, name, email, address")
    .eq("owner_id", userId)
    .in("phone_number", phones);

  const known = new Map((existing ?? []).map((row) => [row.phone_number as string, row]));
  let imported = 0;
  let updated = 0;

  const inserts: Record<string, unknown>[] = [];
  for (const [phone, entry] of byPhone) {
    const row = known.get(phone);
    if (!row) {
      inserts.push({
        owner_id: userId,
        phone_number: phone,
        name: entry.name ?? null,
        email: entry.email ?? null,
        address: entry.address ?? null,
        workspace_id: workspace.id,
      });
      imported += 1;
      continue;
    }
    const patch: Record<string, unknown> = {};
    if (!row.name && entry.name) patch["name"] = entry.name;
    if (!row.email && entry.email) patch["email"] = entry.email;
    if (!row.address && entry.address) patch["address"] = entry.address;
    if (Object.keys(patch).length) {
      const { error } = await supabase.from("contacts").update(patch).eq("id", row.id);
      if (error) throw error;
      updated += 1;
    }
  }

  if (inserts.length) {
    const { error } = await supabase.from("contacts").insert(inserts);
    if (error) throw error;
  }

  return { imported, updated, skipped: entries.length - byPhone.size };
}
