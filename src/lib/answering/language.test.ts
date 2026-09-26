import { describe, expect, it } from "vitest";

import { bookingSpokenLine, resolveAnsweringLanguage, smsTemplate } from "./language";

describe("Spanish answering", () => {
  it("detects Spanish on an auto line and answers the booking in Spanish", () => {
    const language = resolveAnsweringLanguage("auto", "Hola, necesito un plomero para una fuga");
    expect(language).toBe("es");
    expect(bookingSpokenLine("rejected_area", language)).toMatch(/área de servicio/);
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
  });

  it("uses a Spanish reschedule template", () => {
    expect(smsTemplate("reschedule", "es")).toMatch(/REPROGRAMAR|horario/);
  });
});
