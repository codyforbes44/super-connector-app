import { describe, expect, it } from "vitest";

import { parseBookingReply } from "./replies";

describe("parseBookingReply", () => {
  it("confirms, cancels, and reschedules in English and Spanish", () => {
    expect(parseBookingReply("YES")).toBe("confirm");
    expect(parseBookingReply("sí")).toBe("confirm");
    expect(parseBookingReply("Confirmar")).toBe("confirm");
    expect(parseBookingReply("cancel")).toBe("cancel");
    expect(parseBookingReply("cancelar")).toBe("cancel");
    expect(parseBookingReply("reschedule Thursday")).toBe("reschedule");
    expect(parseBookingReply("reprogramar para el viernes")).toBe("reschedule");
  });

  it("leaves carrier STOP and unrelated texts alone", () => {
    expect(parseBookingReply("STOP")).toBe("unknown");
    expect(parseBookingReply("START")).toBe("unknown");
    expect(parseBookingReply("what time works?")).toBe("unknown");
  });
});
