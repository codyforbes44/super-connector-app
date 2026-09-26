import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import {
  bookingSpokenLine,
  detectCallerLanguage,
  elevenLabsAgentLanguage,
  mergeAnsweringLanguagePrompt,
  parseLineLanguage,
  resolveAnsweringLanguage,
  smsTemplate,
  transcriptUtterance,
} from "./language";

describe("Spanish answering", () => {
  it("detects Spanish on an auto line and answers the booking in Spanish", () => {
    const language = resolveAnsweringLanguage("auto", "Hola, necesito un plomero para una fuga");
    expect(language).toBe("es");
    expect(detectCallerLanguage("Necesito un plomero")).toBe("es");
    expect(detectCallerLanguage("I need a plumber tomorrow")).toBe("en");
    expect(bookingSpokenLine("rejected_area", language)).toMatch(/área de servicio/);
    expect(bookingSpokenLine("proposed", language, { when: "martes 9am" })).toMatch(/apartar/);
    expect(bookingSpokenLine("booked", language, { when: "martes 9am" })).toMatch(/reservado/);
    expect(
      smsTemplate("confirmed", language, {
        job: "plomería",
        when: "martes 9am",
        address: "418 Oak",
      }),
    ).toMatch(/confirmada/);
  });

  it("stays in English when the line is English-only", () => {
    expect(resolveAnsweringLanguage("en", "Hola, necesito un plomero")).toBe("en");
    expect(resolveAnsweringLanguage("es", "I need a plumber")).toBe("es");
    expect(resolveAnsweringLanguage("fr", "Hola")).toBe("en");
    expect(resolveAnsweringLanguage(null, "Hola")).toBe("en");
  });

  it("renders Spanish booking texts for proposal, confirm, cancel, and reschedule", () => {
    expect(
      smsTemplate("proposal", "es", { name: "Cody", when: "martes", job: "plomería" }),
    ).toMatch(/propuso/);
    expect(
      smsTemplate("confirmed", "es", { job: "plomería", when: "martes", address: "418 Oak" }),
    ).toMatch(/confirmada/);
    expect(smsTemplate("cancelled", "es")).toMatch(/cancelada/);
    expect(smsTemplate("reschedule", "es")).toMatch(/REPROGRAMAR|horario/);
    expect(smsTemplate("not_registered", "es")).toMatch(/no se envió/);
  });

  it("reads the line setting as en, es, or auto", () => {
    expect(parseLineLanguage("es")).toBe("es");
    expect(parseLineLanguage("auto")).toBe("auto");
    expect(parseLineLanguage("en")).toBe("en");
    expect(parseLineLanguage("fr")).toBe("en");
    expect(parseLineLanguage(null)).toBe("en");
  });

  it("keeps the agent prompt block idempotent and drops it for English", () => {
    const emergency = "[sixvox-emergency]\nTransfer burst pipe calls.\n[/sixvox-emergency]";
    const once = mergeAnsweringLanguagePrompt(`Answer the phone.\n\n${emergency}`, "auto");
    const twice = mergeAnsweringLanguagePrompt(once, "auto");
    expect(twice.match(/\[sixvox-language\]/g)).toHaveLength(1);
    expect(twice).toContain("burst pipe");
    expect(twice).toMatch(/If they speak Spanish/);
    expect(mergeAnsweringLanguagePrompt(twice, "en")).toBe(`Answer the phone.\n\n${emergency}`);
    expect(mergeAnsweringLanguagePrompt("Answer the phone.", "es")).toMatch(
      /entire call in Spanish/,
    );
    expect(elevenLabsAgentLanguage("es")).toBe("es");
    expect(elevenLabsAgentLanguage("auto")).toBe("en");
    expect(elevenLabsAgentLanguage("fr")).toBe("fr");
  });

  it("reads Spanish from a saved transcript", () => {
    const text = transcriptUtterance(
      [{ role: "user", message: "Hola, necesito un plomero" }],
      "English summary",
    );
    expect(resolveAnsweringLanguage("auto", text)).toBe("es");
  });

  it("booking paths use the shared SMS and spoken helpers", () => {
    const source = readFileSync(new URL("../booking-ops.server.ts", import.meta.url), "utf8");
    expect(source).toContain('smsTemplate("confirmed"');
    expect(source).toContain('smsTemplate("cancelled"');
    expect(source).toContain('smsTemplate("reschedule"');
    expect(source).toContain("bookingSpokenLine(");
    expect(source).toContain("resolveAnsweringLanguage");
  });
});
