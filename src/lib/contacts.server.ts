import type { SupabaseClient } from "@supabase/supabase-js";

import {
  buildContactImportPreview,
  type ContactImportPreview,
  type ImportHint,
} from "./contact-import";
import { normalizePhone } from "./twilio.server";
import { requireWorkspace } from "./workspace.server";

type SB = SupabaseClient;

export type ContactInput = {
  phoneNumber: string;
  name?: string | null;
  email?: string | null;
  address?: string | null;
  notes?: string | null;
};

export type ContactImportResult = {
  created: number;
  skippedInvalid: number;
  skippedDuplicate: number;
};

const PHONE_PAGE = 1000;

function clean(value: string | null | undefined) {
  const trimmed = (value ?? "").trim();
  return trimmed.length ? trimmed : null;
}

async function workspacePhoneSet(supabase: SB, workspaceId: string): Promise<Set<string>> {
  const phones = new Set<string>();
  for (let from = 0; from < 50_000; from += PHONE_PAGE) {
    const { data, error } = await supabase
      .from("contacts")
      .select("phone_number")
      .eq("workspace_id", workspaceId)
      .range(from, from + PHONE_PAGE - 1);
    if (error) throw error;
    const rows = data ?? [];
    for (const row of rows) phones.add(String(row.phone_number ?? ""));
    if (rows.length < PHONE_PAGE) break;
  }
  return phones;
}

function isUniqueViolation(error: { code?: string; message?: string }) {
  return error.code === "23505" || /duplicate key/i.test(error.message ?? "");
}

export async function listContacts(supabase: SB, userId: string, search?: string) {
  const workspace = await requireWorkspace(userId);
  let query = supabase
    .from("contacts")
    .select("*")
    .eq("workspace_id", workspace.id)
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
  const workspace = await requireWorkspace(userId);
  const phone = normalizePhone(input.phoneNumber);
  if (!phone || phone === "+") throw new Error("A phone number is required.");

  const fields = {
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
    .eq("workspace_id", workspace.id)
    .eq("phone_number", phone)
    .maybeSingle();

  if (existing) {
    const { error } = await supabase
      .from("contacts")
      .update(fields)
      .eq("id", existing.id)
      .eq("workspace_id", workspace.id);
    if (error) throw error;
  } else {
    const { error } = await supabase.from("contacts").insert({
      ...fields,
      owner_id: userId,
    });
    if (error) throw error;
  }

  const { data } = await supabase
    .from("contacts")
    .select("*")
    .eq("workspace_id", workspace.id)
    .eq("phone_number", phone)
    .maybeSingle();
  return data;
}

export async function deleteContact(supabase: SB, userId: string, id: string) {
  const workspace = await requireWorkspace(userId);
  const { error } = await supabase
    .from("contacts")
    .delete()
    .eq("id", id)
    .eq("workspace_id", workspace.id);
  if (error) throw error;
  return { ok: true };
}

/** Bulk merge from the device address book: adds new numbers, fills blank fields. */
export async function importContacts(supabase: SB, userId: string, entries: ContactInput[]) {
  const workspace = await requireWorkspace(userId);
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

  const phones = [...byPhone.keys()];
  const { data: existing } = await supabase
    .from("contacts")
    .select("id, phone_number, name, email, address")
    .eq("workspace_id", workspace.id)
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
        workspace_id: workspace.id,
        phone_number: phone,
        name: entry.name ?? null,
        email: entry.email ?? null,
        address: entry.address ?? null,
      });
      imported += 1;
      continue;
    }
    const patch: Record<string, unknown> = {};
    if (!row.name && entry.name) patch["name"] = entry.name;
    if (!row.email && entry.email) patch["email"] = entry.email;
    if (!row.address && entry.address) patch["address"] = entry.address;
    if (Object.keys(patch).length) {
      const { error } = await supabase
        .from("contacts")
        .update(patch)
        .eq("id", row.id)
        .eq("workspace_id", workspace.id);
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

export async function previewContactImport(
  supabase: SB,
  userId: string,
  text: string,
  hint: ImportHint = "auto",
): Promise<ContactImportPreview> {
  const workspace = await requireWorkspace(userId);
  const existing = await workspacePhoneSet(supabase, workspace.id);
  return buildContactImportPreview(text, existing, hint);
}

export async function commitContactImport(
  supabase: SB,
  userId: string,
  text: string,
  hint: ImportHint = "auto",
): Promise<ContactImportResult> {
  const workspace = await requireWorkspace(userId);
  const existing = await workspacePhoneSet(supabase, workspace.id);
  const preview = buildContactImportPreview(text, existing, hint);
  const inserts = preview.rows
    .filter((row) => row.status === "create" && row.phone)
    .map((row) => ({
      owner_id: userId,
      workspace_id: workspace.id,
      phone_number: row.phone,
      name: row.name,
      email: row.email,
      address: row.address,
      notes: row.notes,
    }));

  for (let index = 0; index < inserts.length; index += 200) {
    const { error } = await supabase.from("contacts").insert(inserts.slice(index, index + 200));
    if (error) {
      if (isUniqueViolation(error)) {
        throw new Error(
          "Some of these numbers were saved while you were reviewing. Review the list again.",
        );
      }
      throw error;
    }
  }

  return {
    created: inserts.length,
    skippedInvalid: preview.skippedInvalid,
    skippedDuplicate: preview.skippedDuplicate,
  };
}
