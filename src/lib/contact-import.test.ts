import { describe, expect, it } from "vitest";

import {
  buildContactImportPreview,
  classifyContactImport,
  MAX_IMPORT_ROWS,
  normalizeContactPhone,
  parseContactList,
} from "./contact-import";

describe("normalizeContactPhone", () => {
  it("turns common US formats into the same E.164 number", () => {
    expect(normalizeContactPhone("(555) 201-0198")).toBe("+15552010198");
    expect(normalizeContactPhone("555-201-0198")).toBe("+15552010198");
    expect(normalizeContactPhone("1-555-201-0198")).toBe("+15552010198");
    expect(normalizeContactPhone("+1 555 201 0198")).toBe("+15552010198");
    expect(normalizeContactPhone("5552010198 x12")).toBe("+15552010198");
  });

  it("keeps an international number and rejects short or empty values", () => {
    expect(normalizeContactPhone("+44 20 7946 0958")).toBe("+442079460958");
    expect(normalizeContactPhone("555-0100")).toBeNull();
    expect(normalizeContactPhone("call me")).toBeNull();
    expect(normalizeContactPhone("")).toBeNull();
  });
});

describe("parseContactList", () => {
  it("maps header aliases, quoted names, and company into notes", () => {
    const csv = [
      "sep=,",
      "Customer Name,Mobile Phone,E-mail,Company Name,Comments,Street,City,State,Zip",
      '"Rivera, Jane",(555) 201-0198,jane@rivera.example,Rivera Plumbing,"Gate, side door",12 Oak,Austin,TX,78701',
    ].join("\n");
    const parsed = parseContactList(`\uFEFF${csv}`, "csv");
    expect(parsed.truncated).toBe(false);
    expect(parsed.rows).toHaveLength(1);
    expect(parsed.rows[0]).toMatchObject({
      name: "Rivera, Jane",
      phoneRaw: "(555) 201-0198",
      email: "jane@rivera.example",
      address: "12 Oak, Austin, TX 78701",
      notes: "Rivera Plumbing — Gate, side door",
    });
  });

  it("joins first and last name and prefers a cell over a home phone", () => {
    const csv = "First Name,Last Name,Home Phone,Cell\nSam,Ortiz,555-201-0100,555-201-0199\n";
    const parsed = parseContactList(csv, "csv");
    expect(parsed.rows[0]).toMatchObject({
      name: "Sam Ortiz",
      phoneRaw: "555-201-0199",
    });
  });

  it("reads a semicolon file and a headerless row", () => {
    const csv = "Name;Phone;Email\nMike Chen;5552010188;mike@chenhvac.example\n";
    expect(parseContactList(csv, "csv").rows[0]).toMatchObject({
      name: "Mike Chen",
      phoneRaw: "5552010188",
      email: "mike@chenhvac.example",
    });
    expect(parseContactList("Ada Lovelace, 555-201-0144\n", "csv").rows[0]).toMatchObject({
      name: "Ada Lovelace",
      phoneRaw: "555-201-0144",
    });
  });

  it("parses pasted numbers, name-phone lines, and skips a header line", () => {
    const text = ["Name, Phone", "555-201-0144", "Jane Rivera - (555) 201-0198", ""].join("\n");
    const rows = parseContactList(text, "paste").rows;
    expect(rows.map((row) => row.phoneRaw)).toEqual(["555-201-0144", "(555) 201-0198"]);
    expect(rows[1]?.name).toBe("Jane Rivera");
  });

  it("reads a vCard, including a folded note and a second number", () => {
    const vcard = [
      "BEGIN:VCARD",
      "VERSION:3.0",
      "N:Ortiz;Sam;;;",
      "FN:Sam Ortiz",
      "TEL;TYPE=HOME:555-201-0100",
      "TEL;TYPE=CELL:(555) 201-0199",
      "EMAIL:sam@ortiz.example",
      "ORG:Ortiz Electric",
      "NOTE:Prefers morning",
      "  appointments",
      "ADR;TYPE=WORK:;;9 Pine;Dallas;TX;75201;USA",
      "END:VCARD",
    ].join("\n");
    const rows = parseContactList(vcard).rows;
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({
      name: "Sam Ortiz",
      phoneRaw: "(555) 201-0199",
      email: "sam@ortiz.example",
      notes: "Ortiz Electric — Prefers morning appointments",
      address: "9 Pine, Dallas, TX, 75201, USA",
    });
    expect(rows[1]?.phoneRaw).toBe("555-201-0100");
  });

  it("stops after the row cap", () => {
    const lines = Array.from(
      { length: MAX_IMPORT_ROWS + 5 },
      (_, index) => `555201${String(index).padStart(4, "0")}`,
    );
    const parsed = parseContactList(lines.join("\n"), "paste");
    expect(parsed.rows).toHaveLength(MAX_IMPORT_ROWS);
    expect(parsed.truncated).toBe(true);
  });
});

describe("classifyContactImport", () => {
  it("counts creates, invalid phones, and workspace duplicates", () => {
    const parsed = parseContactList(
      [
        "Name,Phone,Email,Company",
        "Jane Rivera,(555) 201-0198,jane@rivera.example,Rivera Plumbing",
        "No Number,,nope@example.com,",
        "Bad,call me,,",
        "Already,(555) 201-0100,,",
        "Jane again,555-201-0198,,",
        "New,555-201-0144,,",
      ].join("\n"),
      "csv",
    );
    const preview = classifyContactImport(parsed.rows, ["+1 (555) 201-0100"]);
    expect(preview.created).toBe(2);
    expect(preview.skippedInvalid).toBe(2);
    expect(preview.skippedDuplicate).toBe(2);
    expect(preview.rows.map((row) => [row.name, row.status, row.reason])).toEqual([
      ["Jane Rivera", "create", "Will add"],
      ["No Number", "invalid", "Missing phone number"],
      ["Bad", "invalid", "Phone number isn't valid"],
      ["Already", "duplicate", "Already in your contacts"],
      ["Jane again", "duplicate", "Repeated in this list"],
      ["New", "create", "Will add"],
    ]);
    expect(preview.rows[0]?.phone).toBe("+15552010198");
    expect(preview.rows[0]?.notes).toBe("Rivera Plumbing");
  });

  it("builds a preview that keeps the truncation flag", () => {
    const lines = ["5552010198", "not-a-phone"];
    const preview = buildContactImportPreview(lines.join("\n"), []);
    expect(preview.created).toBe(1);
    expect(preview.skippedInvalid).toBe(1);
    expect(preview.truncated).toBe(false);
  });
});
