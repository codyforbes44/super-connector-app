import { describe, expect, it } from "vitest";

import {
  HOUSECALL_ZAPIER_COPY,
  buildHousecallCustomer,
  buildHousecallLead,
  housecallPhone,
} from "./housecall";

const CALL = {
  firstName: "Dana",
  lastName: "Brooks",
  phone: "+1 (580) 555-0144",
  email: "dana@example.com",
  street: "18 Oak Street",
  city: "Tulsa",
  state: "OK",
  zip: "74103",
  summary: "Garage door spring broke. Needs a same-day look.",
};

describe("Housecall Pro non-MAX copy", () => {
  it("points at Settings outbound webhooks instead of a future sender", () => {
    expect(HOUSECALL_ZAPIER_COPY).toMatch(/Settings → Outbound webhooks/);
    expect(HOUSECALL_ZAPIER_COPY).toMatch(/HMAC-SHA256/);
    expect(HOUSECALL_ZAPIER_COPY).not.toMatch(/being added separately/i);
  });
});

describe("Housecall Pro payload mapping", () => {
  it("maps a call to a customer with a service address", () => {
    expect(housecallPhone(CALL.phone)).toBe("5805550144");
    const customer = buildHousecallCustomer(CALL);
    expect(customer).toMatchObject({
      first_name: "Dana",
      last_name: "Brooks",
      mobile_number: "5805550144",
      email: "dana@example.com",
      lead_source: "SixVox",
      notes: CALL.summary,
    });
    expect(customer["addresses"]).toEqual([
      {
        type: "service",
        street: "18 Oak Street",
        street_line_2: "",
        city: "Tulsa",
        state: "OK",
        zip: "74103",
        country: "US",
      },
    ]);
  });

  it("maps a lead onto the created customer id", () => {
    const lead = buildHousecallLead(CALL, "cus_123");
    expect(lead["customer_id"]).toBe("cus_123");
    expect(lead["note"]).toBe(CALL.summary);
    expect(lead["lead_source"]).toBe("SixVox");
    expect(lead["address"]).toMatchObject({ street: "18 Oak Street", zip: "74103" });
  });
});
