/**
 * Jobber GraphQL (version 2025-04-16) and OAuth 2.0 + PKCE.
 * Docs: https://developer.getjobber.com/docs/building_your_app/app_authorization/
 * and https://developer.getjobber.com/docs/using_jobbers_api/api_queries_and_mutations/
 *
 * Scopes are configured on the Jobber app in the Developer Center (clients and
 * requests). Tokens stay on the server.
 */

export const JOBBER_GRAPHQL_VERSION = "2025-04-16";
export const JOBBER_AUTHORIZE_URL = "https://api.getjobber.com/api/oauth/authorize";
export const JOBBER_TOKEN_URL = "https://api.getjobber.com/api/oauth/token";
export const JOBBER_GRAPHQL_URL = "https://api.getjobber.com/api/graphql";

export type JobberPhone = { number?: string | null; primary?: boolean | null };

export type JobberClientNode = {
  id: string;
  firstName?: string | null;
  lastName?: string | null;
  companyName?: string | null;
  phones?: JobberPhone[] | null;
  properties?: { nodes?: Array<{ id: string }> | null } | null;
};

export type JobberAddress = {
  street: string;
  city?: string | null | undefined;
  state?: string | null | undefined;
  postalCode?: string | null | undefined;
};

export type JobberCallInput = {
  phone: string;
  firstName?: string | null | undefined;
  lastName?: string | null | undefined;
  email?: string | null | undefined;
  companyName?: string | null | undefined;
  address?: JobberAddress | null | undefined;
  summary: string;
};

export type GraphqlResponse = {
  data?: Record<string, unknown> | null;
  errors?: Array<{ message?: string }>;
};

export type JobberGraphql = (
  query: string,
  variables: Record<string, unknown>,
) => Promise<GraphqlResponse>;

export type JobberSyncResult = {
  clientId: string;
  matchedExistingClient: boolean;
  requestId: string;
  noteId: string | null;
};

const FIND_CLIENTS = `
  query FindClients($search: String!) {
    clients(first: 20, searchTerm: $search) {
      nodes {
        id
        firstName
        lastName
        companyName
        phones { number primary }
        properties { nodes { id } }
      }
    }
  }
`;

const CREATE_CLIENT = `
  mutation CreateClient($input: ClientCreateInput!) {
    clientCreate(input: $input) {
      client { id firstName lastName }
      userErrors { message path }
    }
  }
`;

const CREATE_REQUEST = `
  mutation CreateRequest($input: RequestCreateInput!) {
    requestCreate(input: $input) {
      request { id title }
      userErrors { message path }
    }
  }
`;

const CREATE_NOTE = `
  mutation LogCallNote($input: NoteCreateInput!) {
    noteCreate(input: $input) {
      note { id }
      userErrors { message path }
    }
  }
`;

export function digitsLast10(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  return digits.length <= 10 ? digits : digits.slice(-10);
}

export function splitName(
  first?: string | null,
  last?: string | null,
  fallback?: string | null,
): {
  firstName: string;
  lastName: string;
} {
  const explicitFirst = first?.trim() ?? "";
  const explicitLast = last?.trim() ?? "";
  if (explicitFirst || explicitLast) {
    return {
      firstName: explicitFirst || "Caller",
      lastName: explicitLast || "Customer",
    };
  }
  const parts = (fallback ?? "").trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return { firstName: "Caller", lastName: "Customer" };
  if (parts.length === 1) return { firstName: parts[0]!, lastName: "Customer" };
  return { firstName: parts[0]!, lastName: parts.slice(1).join(" ") };
}

/** Prefer an exact last-10 phone match. Primary phones win ties. */
export function matchJobberClient(
  clients: JobberClientNode[],
  phone: string,
): JobberClientNode | null {
  const needle = digitsLast10(phone);
  if (!needle) return null;
  const hits = clients.filter((client) =>
    (client.phones ?? []).some((entry) => digitsLast10(entry.number ?? "") === needle),
  );
  if (!hits.length) return null;
  const primary = hits.find((client) =>
    (client.phones ?? []).some(
      (entry) => entry.primary && digitsLast10(entry.number ?? "") === needle,
    ),
  );
  return primary ?? hits[0]!;
}

export function buildClientInput(input: JobberCallInput): Record<string, unknown> {
  const name = splitName(input.firstName, input.lastName);
  const body: Record<string, unknown> = {
    firstName: name.firstName,
    lastName: name.lastName,
    phones: [{ number: input.phone, primary: true, description: "MAIN" }],
  };
  if (input.companyName?.trim()) body["companyName"] = input.companyName.trim();
  if (input.email?.trim()) {
    body["emails"] = [{ address: input.email.trim(), primary: true, description: "MAIN" }];
  }
  if (input.address?.street?.trim()) {
    body["properties"] = [{ address: addressAttributes(input.address) }];
  }
  return body;
}

function addressAttributes(address: JobberAddress): Record<string, string> {
  return {
    street1: address.street.trim(),
    city: address.city?.trim() || "",
    province: address.state?.trim() || "",
    postalCode: address.postalCode?.trim() || "",
    country: "United States",
  };
}

export function buildRequestInput(
  input: JobberCallInput,
  clientId: string,
  propertyId?: string | null,
): Record<string, unknown> {
  const summary = input.summary.trim();
  const title = summary.split("\n")[0]?.slice(0, 120) || "Phone request from SixVox";
  const body: Record<string, unknown> = {
    clientId,
    title,
    source: "Phone Call",
    assessment: { instructions: summary },
  };
  if (propertyId) body["propertyId"] = propertyId;
  else if (input.address?.street?.trim()) {
    body["property"] = { address: addressAttributes(input.address) };
  }
  return body;
}

export function buildNoteInput(requestId: string, summary: string): Record<string, unknown> {
  return {
    message: summary.trim(),
    attachedTo: "REQUEST",
    attachedToId: requestId,
  };
}

type UserError = { message?: string; path?: string[] | string };

function userErrorMessage(errors: UserError[] | undefined, fallback: string): string | null {
  if (!errors?.length) return null;
  return errors
    .map((error) => {
      const path = Array.isArray(error.path) ? error.path.join(".") : error.path;
      return path ? `${path}: ${error.message ?? fallback}` : (error.message ?? fallback);
    })
    .join("; ");
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object") return null;
  return value as Record<string, unknown>;
}

async function mutate(
  graphql: JobberGraphql,
  query: string,
  variables: Record<string, unknown>,
  field: string,
): Promise<Record<string, unknown>> {
  const result = await graphql(query, variables);
  if (result.errors?.length) {
    throw new Error(result.errors.map((error) => error.message ?? "Jobber error").join("; "));
  }
  const payload = asRecord(result.data?.[field]);
  if (!payload) throw new Error(`Jobber ${field} returned no data.`);
  const message = userErrorMessage(payload["userErrors"] as UserError[] | undefined, "rejected");
  if (message) throw new Error(message);
  return payload;
}

export async function syncCallToJobber(
  graphql: JobberGraphql,
  input: JobberCallInput,
): Promise<JobberSyncResult> {
  const summary = input.summary.trim();
  if (!summary) throw new Error("Add a call summary before sending this to Jobber.");
  if (!digitsLast10(input.phone))
    throw new Error("A phone number is required to match a Jobber client.");

  const found = await graphql(FIND_CLIENTS, { search: digitsLast10(input.phone) });
  if (found.errors?.length) {
    throw new Error(
      found.errors.map((error) => error.message ?? "Jobber search failed").join("; "),
    );
  }
  const clientsRoot = asRecord(found.data?.["clients"]);
  const nodes = (clientsRoot?.["nodes"] as JobberClientNode[] | undefined) ?? [];
  const match = matchJobberClient(nodes, input.phone);

  let clientId = match?.id ?? "";
  let matchedExistingClient = Boolean(match);
  if (!match) {
    const created = await mutate(
      graphql,
      CREATE_CLIENT,
      { input: buildClientInput(input) },
      "clientCreate",
    );
    const client = asRecord(created["client"]);
    clientId = typeof client?.["id"] === "string" ? client["id"] : "";
    matchedExistingClient = false;
  }
  if (!clientId) throw new Error("Jobber did not return a client id.");

  const propertyId = match?.properties?.nodes?.[0]?.id ?? null;
  const requestPayload = await mutate(
    graphql,
    CREATE_REQUEST,
    { input: buildRequestInput(input, clientId, propertyId) },
    "requestCreate",
  );
  const request = asRecord(requestPayload["request"]);
  const requestId = typeof request?.["id"] === "string" ? request["id"] : "";
  if (!requestId) throw new Error("Jobber did not return a request id.");

  let noteId: string | null = null;
  try {
    const notePayload = await mutate(
      graphql,
      CREATE_NOTE,
      { input: buildNoteInput(requestId, summary) },
      "noteCreate",
    );
    const note = asRecord(notePayload["note"]);
    noteId = typeof note?.["id"] === "string" ? note["id"] : null;
  } catch (error) {
    // The summary is already on the request assessment. A note-schema mismatch
    // should not drop the request that was just created.
    console.error("Jobber note was not saved", error);
  }

  return { clientId, matchedExistingClient, requestId, noteId };
}

export function jobberAuthorizeUrl(input: {
  clientId: string;
  redirectUri: string;
  state: string;
  codeChallenge: string;
}): string {
  const url = new URL(JOBBER_AUTHORIZE_URL);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("client_id", input.clientId);
  url.searchParams.set("redirect_uri", input.redirectUri);
  url.searchParams.set("state", input.state);
  url.searchParams.set("code_challenge", input.codeChallenge);
  url.searchParams.set("code_challenge_method", "S256");
  return url.toString();
}

export async function createPkcePair(): Promise<{ verifier: string; challenge: string }> {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  const verifier = base64Url(bytes);
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier));
  return { verifier, challenge: base64Url(new Uint8Array(digest)) };
}

function base64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

export type JobberTokenResponse = {
  access_token: string;
  refresh_token?: string;
  expires_in?: number;
};

export async function exchangeJobberCode(
  fetchImpl: typeof fetch,
  input: {
    clientId: string;
    clientSecret: string;
    code: string;
    redirectUri: string;
    codeVerifier: string;
  },
): Promise<JobberTokenResponse> {
  const body = new URLSearchParams({
    client_id: input.clientId,
    client_secret: input.clientSecret,
    grant_type: "authorization_code",
    code: input.code,
    redirect_uri: input.redirectUri,
    code_verifier: input.codeVerifier,
  });
  const response = await fetchImpl(JOBBER_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  const json = (await response.json()) as JobberTokenResponse & { error?: string };
  if (!response.ok || !json.access_token) {
    throw new Error(json.error || "Jobber did not return an access token.");
  }
  return json;
}

export function createJobberGraphql(fetchImpl: typeof fetch, accessToken: string): JobberGraphql {
  return async (query, variables) => {
    const response = await fetchImpl(JOBBER_GRAPHQL_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "X-JOBBER-GRAPHQL-VERSION": JOBBER_GRAPHQL_VERSION,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ query, variables }),
    });
    if (response.status === 401) throw new Error("Jobber access expired. Reconnect Jobber.");
    return (await response.json()) as GraphqlResponse;
  };
}
