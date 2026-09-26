/**
 * Parse a tradesperson's customer list (CSV, paste, or vCard) and decide
 * which rows can be saved. Phone numbers are normalized to E.164 so duplicates
 * match contacts already stored for the workspace.
 */

export const MAX_IMPORT_ROWS = 2000;
export const MAX_IMPORT_CHARS = 1_000_000;

export type ImportHint = "auto" | "csv" | "vcard" | "paste";

export type ParsedContactRow = {
  line: number;
  name: string | null;
  phoneRaw: string;
  email: string | null;
  address: string | null;
  notes: string | null;
};

export type ImportRowStatus = "create" | "invalid" | "duplicate";

export type ClassifiedImportRow = {
  line: number;
  name: string | null;
  phoneRaw: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  notes: string | null;
  status: ImportRowStatus;
  reason: string;
};

export type ContactImportPreview = {
  rows: ClassifiedImportRow[];
  created: number;
  skippedInvalid: number;
  skippedDuplicate: number;
  truncated: boolean;
};

type Field =
  | "name"
  | "first"
  | "last"
  | "phone"
  | "email"
  | "company"
  | "notes"
  | "address"
  | "city"
  | "state"
  | "zip";

const HEADER_FIELDS: Record<string, Field> = {
  name: "name",
  "full name": "name",
  fullname: "name",
  contact: "name",
  "contact name": "name",
  customer: "name",
  "customer name": "name",
  "display name": "name",
  "client name": "name",
  first: "first",
  "first name": "first",
  firstname: "first",
  "given name": "first",
  last: "last",
  "last name": "last",
  lastname: "last",
  surname: "last",
  "family name": "last",
  phone: "phone",
  "phone number": "phone",
  phonenumber: "phone",
  telephone: "phone",
  tel: "phone",
  mobile: "phone",
  "mobile phone": "phone",
  "mobile number": "phone",
  cell: "phone",
  "cell phone": "phone",
  "cell number": "phone",
  "primary phone": "phone",
  "phone 1": "phone",
  "main phone": "phone",
  "home phone": "phone",
  "work phone": "phone",
  email: "email",
  "e mail": "email",
  "email address": "email",
  "e mail address": "email",
  company: "company",
  "company name": "company",
  business: "company",
  "business name": "company",
  organization: "company",
  organisation: "company",
  org: "company",
  notes: "notes",
  note: "notes",
  comments: "notes",
  comment: "notes",
  address: "address",
  street: "address",
  "street address": "address",
  "service address": "address",
  city: "city",
  town: "city",
  state: "state",
  province: "state",
  zip: "zip",
  "zip code": "zip",
  postal: "zip",
  "postal code": "zip",
};

type HeaderHit = { field: Field; index: number; header: string };

/** Same digit rules as `normalizePhone`, then reject anything that is not E.164. */
export function normalizeContactPhone(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;
  const withoutChannel = trimmed.replace(/^whatsapp:/i, "");
  const withoutExt = withoutChannel.replace(/(?:ext\.?|extension|x)\s*\d+\s*$/i, "");
  const digits = withoutExt.replace(/[^\d+]/g, "");
  if (!digits || digits === "+") return null;
  let e164: string;
  if (digits.startsWith("+")) e164 = digits;
  else if (digits.length === 10) e164 = `+1${digits}`;
  else e164 = `+${digits}`;
  const numeric = e164.slice(1);
  if (!/^[1-9]\d{7,14}$/.test(numeric)) return null;
  return `+${numeric}`;
}

export function parseContactList(
  text: string,
  hint: ImportHint = "auto",
): { rows: ParsedContactRow[]; truncated: boolean } {
  const source = text.replace(/^\uFEFF/, "");
  if (!source.trim()) return { rows: [], truncated: false };
  const mode = resolveMode(source, hint);
  switch (mode) {
    case "vcard":
      return cap(parseVcards(source));
    case "csv":
      return cap(parseCsvContacts(source));
    case "paste":
      return cap(parsePaste(source));
    default: {
      const unreachable: never = mode;
      return unreachable;
    }
  }
}

export function classifyContactImport(
  rows: ParsedContactRow[],
  existingPhones: Iterable<string>,
): ContactImportPreview {
  const existing = new Set<string>();
  for (const phone of existingPhones) {
    const normalized = normalizeContactPhone(phone);
    if (normalized) existing.add(normalized);
  }

  const seen = new Set<string>();
  const classified: ClassifiedImportRow[] = [];
  for (const row of rows) {
    const phone = normalizeContactPhone(row.phoneRaw);
    const base = {
      line: row.line,
      name: row.name,
      phoneRaw: row.phoneRaw,
      email: row.email,
      address: row.address,
      notes: row.notes,
    };
    if (!row.phoneRaw.trim()) {
      classified.push({
        ...base,
        phone: null,
        status: "invalid",
        reason: "Missing phone number",
      });
      continue;
    }
    if (!phone) {
      classified.push({
        ...base,
        phone: null,
        status: "invalid",
        reason: "Phone number isn't valid",
      });
      continue;
    }
    if (existing.has(phone) || seen.has(phone)) {
      classified.push({
        ...base,
        phone,
        status: "duplicate",
        reason: existing.has(phone) ? "Already in your contacts" : "Repeated in this list",
      });
      continue;
    }
    seen.add(phone);
    classified.push({ ...base, phone, status: "create", reason: "Will add" });
  }

  return {
    rows: classified,
    created: classified.filter((row) => row.status === "create").length,
    skippedInvalid: classified.filter((row) => row.status === "invalid").length,
    skippedDuplicate: classified.filter((row) => row.status === "duplicate").length,
    truncated: false,
  };
}

export function buildContactImportPreview(
  text: string,
  existingPhones: Iterable<string>,
  hint: ImportHint = "auto",
): ContactImportPreview {
  const parsed = parseContactList(text, hint);
  const preview = classifyContactImport(parsed.rows, existingPhones);
  return { ...preview, truncated: parsed.truncated };
}

function resolveMode(text: string, hint: ImportHint): "vcard" | "csv" | "paste" {
  if (hint === "vcard" || (hint !== "csv" && /^\s*BEGIN:VCARD/im.test(text))) return "vcard";
  if (hint === "paste") return "paste";
  return tableDelimiter(text) ? "csv" : "paste";
}

function cap(rows: ParsedContactRow[]): { rows: ParsedContactRow[]; truncated: boolean } {
  if (rows.length <= MAX_IMPORT_ROWS) return { rows, truncated: false };
  return { rows: rows.slice(0, MAX_IMPORT_ROWS), truncated: true };
}

function clean(value: string | null | undefined): string | null {
  const trimmed = (value ?? "").replace(/\s+/g, " ").trim();
  return trimmed.length ? trimmed : null;
}

function clip(value: string | null, max: number): string | null {
  if (!value) return null;
  return value.length > max ? value.slice(0, max) : value;
}

function cleanEmail(value: string | null | undefined): string | null {
  const email = clean(value);
  if (!email || !email.includes("@") || /\s/.test(email) || email.length > 320) return null;
  return email;
}

function normalizeHeader(value: string): string {
  return value
    .toLowerCase()
    .replace(/[_./]+/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function phoneRank(header: string): number {
  if (header.includes("mobile") || header.includes("cell") || header.includes("primary")) return 0;
  if (header.includes("home") || header.includes("work")) return 2;
  return 1;
}

function personName(full: string | null, first: string | null, last: string | null): string | null {
  if (full) return clip(full, 200);
  const joined = [first, last]
    .map((part) => clean(part))
    .filter((part): part is string => Boolean(part))
    .join(" ");
  return clip(joined || null, 200);
}

function mergeNotes(
  company: string | null,
  notes: string | null,
  extra?: string | null,
): string | null {
  const parts = [company, notes, extra]
    .map((part) => clean(part))
    .filter((part): part is string => Boolean(part));
  const unique: string[] = [];
  for (const part of parts) {
    if (unique.some((existing) => existing.toLowerCase() === part.toLowerCase())) continue;
    unique.push(part);
  }
  return clip(unique.join(" — ") || null, 2000);
}

function joinAddress(
  address: string | null,
  city: string | null,
  state: string | null,
  zip: string | null,
): string | null {
  const locality = [clean(state), clean(zip)].filter((part): part is string => Boolean(part));
  const parts = [clean(address), clean(city), locality.join(" ") || null].filter(
    (part): part is string => Boolean(part),
  );
  return clip(parts.join(", ") || null, 300);
}

function parseCsv(text: string, delimiter: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let inQuotes = false;
  const src = text.replace(/^\uFEFF/, "");
  for (let i = 0; i < src.length; i += 1) {
    const char = src[i] ?? "";
    if (inQuotes) {
      if (char === '"') {
        if (src[i + 1] === '"') {
          cell += '"';
          i += 1;
        } else {
          inQuotes = false;
        }
      } else {
        cell += char;
      }
      continue;
    }
    if (char === '"') {
      inQuotes = true;
      continue;
    }
    if (char === delimiter) {
      row.push(cell.trim());
      cell = "";
      continue;
    }
    if (char === "\n" || char === "\r") {
      if (char === "\r" && src[i + 1] === "\n") i += 1;
      row.push(cell.trim());
      cell = "";
      if (row.some((value) => value.length > 0)) rows.push(row);
      row = [];
      continue;
    }
    cell += char;
  }
  row.push(cell.trim());
  if (row.some((value) => value.length > 0)) rows.push(row);
  return rows;
}

function tableDelimiter(text: string): "," | ";" | "\t" | null {
  const sample =
    text.split(/\r?\n/).find((line) => line.trim() && !/^sep=/i.test(line.trim())) ?? "";
  let best: { delim: "," | ";" | "\t"; count: number } | null = null;
  for (const delim of [",", ";", "\t"] as const) {
    const cells = parseCsv(`${sample}\n`, delim)[0] ?? [];
    if (!best || cells.length > best.count) best = { delim, count: cells.length };
  }
  if (!best || best.count < 2) return null;
  return best.delim;
}

function parseCsvContacts(text: string): ParsedContactRow[] {
  const delimiter = tableDelimiter(text) ?? ",";
  const table = parseCsv(text, delimiter).filter((row) => !/^sep=/i.test((row[0] ?? "").trim()));
  if (!table.length) return [];
  const header = mapHeaders(table[0] ?? []);
  const data = header ? table.slice(1) : table;
  return data.map((cells, index) =>
    header ? rowFromHeader(cells, header, index + 2) : rowFromLooseCells(cells, index + 1),
  );
}

function mapHeaders(cells: string[]): HeaderHit[] | null {
  const mapped = cells
    .map((cell, index) => ({
      field: HEADER_FIELDS[normalizeHeader(cell)],
      index,
      header: normalizeHeader(cell),
    }))
    .filter((item): item is HeaderHit => Boolean(item.field));
  if (!mapped.some((item) => item.field === "phone")) return null;
  return mapped;
}

function rowFromHeader(cells: string[], mapped: HeaderHit[], line: number): ParsedContactRow {
  const take = (field: Field) => {
    const hit = mapped.find((item) => item.field === field);
    return clean(hit ? cells[hit.index] : null);
  };
  const phoneHits = mapped
    .filter((item) => item.field === "phone")
    .sort((a, b) => phoneRank(a.header) - phoneRank(b.header) || a.index - b.index);
  let phoneRaw = "";
  for (const hit of phoneHits) {
    const value = cells[hit.index] ?? "";
    if (normalizeContactPhone(value)) {
      phoneRaw = value;
      break;
    }
  }
  if (!phoneRaw && phoneHits[0]) phoneRaw = cells[phoneHits[0].index] ?? "";
  return finishRow({
    line,
    name: personName(take("name"), take("first"), take("last")),
    phoneRaw,
    email: cleanEmail(take("email")),
    address: joinAddress(take("address"), take("city"), take("state"), take("zip")),
    notes: mergeNotes(take("company"), take("notes")),
  });
}

function rowFromLooseCells(cells: string[], line: number): ParsedContactRow {
  let phoneRaw = "";
  let email: string | null = null;
  const text: string[] = [];
  for (const cell of cells) {
    const value = clean(cell);
    if (!value) continue;
    if (!phoneRaw && normalizeContactPhone(value)) {
      phoneRaw = value;
      continue;
    }
    if (!email && value.includes("@")) {
      email = cleanEmail(value);
      continue;
    }
    text.push(value);
  }
  return finishRow({
    line,
    name: text[0] ?? null,
    phoneRaw,
    email,
    address: null,
    notes: mergeNotes(null, text.slice(1).join(" — ") || null),
  });
}

function finishRow(row: ParsedContactRow): ParsedContactRow {
  return {
    ...row,
    name: clip(clean(row.name), 200),
    phoneRaw: row.phoneRaw.trim(),
    email: cleanEmail(row.email),
    address: clip(clean(row.address), 300),
    notes: clip(clean(row.notes), 2000),
  };
}

function parsePaste(text: string): ParsedContactRow[] {
  const lines = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n");
  const rows: ParsedContactRow[] = [];
  lines.forEach((line, index) => {
    const parsed = parsePasteLine(line, index + 1);
    if (parsed) rows.push(parsed);
  });
  return rows;
}

function parsePasteLine(line: string, lineNo: number): ParsedContactRow | null {
  const trimmed = line.trim();
  if (!trimmed || /^sep=/i.test(trimmed)) return null;
  const delimiter = trimmed.includes("\t")
    ? "\t"
    : trimmed.includes(";") && !trimmed.includes(",")
      ? ";"
      : ",";
  const cells = (parseCsv(`${trimmed}\n`, delimiter)[0] ?? [])
    .map((cell) => cell.trim())
    .filter((cell) => cell.length > 0);
  if (!cells.length) return null;
  if (cells.every((cell) => HEADER_FIELDS[normalizeHeader(cell)])) return null;
  if (cells.length >= 2) return rowFromLooseCells(cells, lineNo);
  const dashed = trimmed.split(/\s+[-–—]\s+/);
  if (dashed.length === 2) return rowFromLooseCells(dashed, lineNo);
  return rowFromLooseCells(cells, lineNo);
}

function unfold(text: string): string[] {
  const raw = text
    .replace(/^\uFEFF/, "")
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .split("\n");
  const lines: string[] = [];
  for (const line of raw) {
    if ((line.startsWith(" ") || line.startsWith("\t")) && lines.length) {
      lines[lines.length - 1] += line.slice(1);
    } else {
      lines.push(line);
    }
  }
  return lines;
}

function unescapeVcard(value: string): string {
  return value
    .replace(/\\n/gi, " ")
    .replace(/\\,/g, ",")
    .replace(/\\;/g, ";")
    .replace(/\\\\/g, "\\")
    .trim();
}

type VcardDraft = {
  line: number;
  names: string[];
  phones: { value: string; rank: number }[];
  email: string | null;
  company: string | null;
  notes: string | null;
  address: string | null;
};

function parseVcards(text: string): ParsedContactRow[] {
  const lines = unfold(text);
  const rows: ParsedContactRow[] = [];
  let current: VcardDraft | null = null;
  lines.forEach((line, index) => {
    const trimmed = line.trim();
    if (/^BEGIN:VCARD/i.test(trimmed)) {
      current = {
        line: index + 1,
        names: [],
        phones: [],
        email: null,
        company: null,
        notes: null,
        address: null,
      };
      return;
    }
    if (!current) return;
    if (/^END:VCARD/i.test(trimmed)) {
      const name = current.names[0] ?? null;
      const phones = [...current.phones].sort((a, b) => a.rank - b.rank);
      const values = phones.length ? phones : [{ value: "", rank: 1 }];
      for (const phone of values) {
        rows.push(
          finishRow({
            line: current.line,
            name,
            phoneRaw: phone.value,
            email: current.email,
            address: current.address,
            notes: mergeNotes(current.company, current.notes),
          }),
        );
      }
      current = null;
      return;
    }
    const splitAt = line.indexOf(":");
    if (splitAt < 0) return;
    const key = (line.slice(0, splitAt).split(";")[0] ?? "").trim().toUpperCase();
    const value = unescapeVcard(line.slice(splitAt + 1));
    if (!value) return;
    if (key === "FN") current.names.unshift(value);
    else if (key === "N") {
      const [last, first] = value.split(";");
      const joined = [first, last]
        .map((part) => part?.trim())
        .filter((part): part is string => Boolean(part))
        .join(" ");
      if (joined) current.names.push(joined);
    } else if (key === "TEL") {
      current.phones.push({ value, rank: /CELL|MOBILE/i.test(line) ? 0 : 1 });
    } else if (key === "EMAIL" && !current.email) current.email = value;
    else if (key === "ORG" && !current.company) {
      current.company = value.split(";")[0]?.trim() || value;
    } else if (key === "NOTE") {
      current.notes = current.notes ? `${current.notes} ${value}` : value;
    } else if (key === "ADR" && !current.address) {
      const parts = value
        .split(";")
        .map((part) => part.trim())
        .filter(Boolean);
      current.address = parts.join(", ") || null;
    }
  });
  return rows;
}
