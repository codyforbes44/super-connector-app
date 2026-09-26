import { describe, expect, it, vi } from "vitest";

import {
  createJobberGraphql,
  matchJobberClient,
  syncCallToJobber,
  type JobberClientNode,
} from "./jobber";

const ADDRESS = {
  street: "18 Oak Street",
  city: "Tulsa",
  state: "OK",
  postalCode: "74103",
};

const CALL = {
  phone: "+1 (580) 555-0144",
  firstName: "Dana",
  lastName: "Brooks",
  email: "dana@example.com",
  address: ADDRESS,
  summary: "Water heater is leaking in the garage.\nWants a visit Thursday morning.",
};

function client(partial: Partial<JobberClientNode> & { id: string }): JobberClientNode {
  return partial;
}

describe("Jobber client matching", () => {
  const clients: JobberClientNode[] = [
    client({
      id: "client_other",
      phones: [{ number: "580-555-0199", primary: true }],
    }),
    client({
      id: "client_match",
      firstName: "Dana",
      phones: [{ number: "(580) 555-0144", primary: true }],
      properties: { nodes: [{ id: "prop_1" }] },
    }),
    client({
      id: "client_secondary",
      phones: [{ number: "+15805550144", primary: false }],
    }),
  ];

  it("matches the primary phone on the last 10 digits", () => {
    expect(matchJobberClient(clients, "+15805550144")?.id).toBe("client_match");
  });

  it("returns null when nobody matches", () => {
    expect(matchJobberClient(clients, "+14055550100")).toBeNull();
  });
});

describe("Jobber request creation", () => {
  it("creates a request and note for a matched client", async () => {
    const calls: Array<{ query: string; variables: Record<string, unknown> }> = [];
    const result = await syncCallToJobber(async (query, variables) => {
      calls.push({ query, variables });
      if (query.includes("FindClients")) {
        return {
          data: {
            clients: {
              nodes: [
                {
                  id: "client_match",
                  phones: [{ number: "5805550144", primary: true }],
                  properties: { nodes: [{ id: "prop_1" }] },
                },
              ],
            },
          },
        };
      }
      if (query.includes("requestCreate")) {
        return { data: { requestCreate: { request: { id: "req_9" }, userErrors: [] } } };
      }
      if (query.includes("noteCreate")) {
        return { data: { noteCreate: { note: { id: "note_3" }, userErrors: [] } } };
      }
      throw new Error(query);
    }, CALL);

    expect(result).toEqual({
      clientId: "client_match",
      matchedExistingClient: true,
      requestId: "req_9",
      noteId: "note_3",
    });
    expect(calls.some((call) => call.query.includes("clientCreate"))).toBe(false);
    const request = calls.find((call) => call.query.includes("requestCreate"));
    const requestInput = request?.variables["input"] as Record<string, unknown>;
    expect(requestInput["clientId"]).toBe("client_match");
    expect(requestInput["propertyId"]).toBe("prop_1");
    expect(requestInput["property"]).toBeUndefined();
    expect(JSON.stringify(requestInput["assessment"])).toContain("Water heater is leaking");
    const note = calls.find((call) => call.query.includes("noteCreate"));
    expect((note?.variables["input"] as { message: string }).message).toContain("Thursday morning");
  });

  it("creates a client when the phone does not match", async () => {
    const calls: string[] = [];
    const result = await syncCallToJobber(async (query, variables) => {
      calls.push(query);
      if (query.includes("FindClients")) return { data: { clients: { nodes: [] } } };
      if (query.includes("clientCreate")) {
        const input = variables["input"] as { phones: Array<{ number: string }> };
        expect(input.phones[0]?.number).toBe(CALL.phone);
        return { data: { clientCreate: { client: { id: "client_new" }, userErrors: [] } } };
      }
      if (query.includes("requestCreate")) {
        const input = variables["input"] as { property: { address: { street1: string } } };
        expect(input.property.address.street1).toBe("18 Oak Street");
        return { data: { requestCreate: { request: { id: "req_new" }, userErrors: [] } } };
      }
      if (query.includes("noteCreate")) {
        return { data: { noteCreate: { note: { id: "note_new" }, userErrors: [] } } };
      }
      throw new Error(query);
    }, CALL);

    expect(result.matchedExistingClient).toBe(false);
    expect(result.clientId).toBe("client_new");
    expect(result.requestId).toBe("req_new");
    expect(calls.some((query) => query.includes("clientCreate"))).toBe(true);
  });

  it("sends the GraphQL version header from the mocked fetch", async () => {
    const fetchImpl = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => {
      return new Response(JSON.stringify({ data: { clients: { nodes: [] } } }), { status: 200 });
    });
    const graphql = createJobberGraphql(fetchImpl, "token-not-for-the-client");
    await graphql("query FindClients { clients { nodes { id } } }", {});
    const init = fetchImpl.mock.calls[0]?.[1];
    const headers = new Headers(init?.headers);
    expect(headers.get("Authorization")).toBe("Bearer token-not-for-the-client");
    expect(headers.get("X-JOBBER-GRAPHQL-VERSION")).toBe("2025-04-16");
  });
});
