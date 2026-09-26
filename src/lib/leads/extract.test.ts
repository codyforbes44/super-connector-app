import { describe, expect, it } from "vitest";

import { extractLeadFields } from "./extract";

const ENGLISH = `
Caller: Hi, this is Maria Lopez. My kitchen sink is leaking and it's an emergency.
Caller: The address is 418 Oak Street, Tulsa, OK 74103.
Caller: Please call me back at 580-555-0142.
`;

const SPANISH = `
Caller: Hola, me llamo Juan Pérez. Tengo una fuga de agua, es una emergencia.
Caller: La dirección es 200 Main Street, Oklahoma City, OK 73102.
Caller: Mi número es 405-555-0199.
`;

describe("extractLeadFields", () => {
  it("reads name, callback, address, job, and urgency from an English transcript", () => {
    const lead = extractLeadFields(ENGLISH);
    expect(lead.name).toBe("Maria Lopez");
    expect(lead.callbackNumber).toBe("+15805550142");
    expect(lead.address).toMatch(/418 Oak Street/);
    expect(lead.address).toMatch(/74103/);
    expect(lead.jobType).toBe("plumbing");
    expect(lead.urgency).toBe("high");
    expect(lead.tags).toContain("plumbing");
  });

  it("reads the same fields from a Spanish transcript", () => {
    const lead = extractLeadFields(SPANISH);
    expect(lead.name).toBe("Juan Pérez");
    expect(lead.callbackNumber).toBe("+14055550199");
    expect(lead.address).toMatch(/73102/);
    expect(lead.jobType).toBe("plumbing");
    expect(lead.urgency).toBe("high");
  });
});
