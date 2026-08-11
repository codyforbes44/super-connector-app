/**
 * Server-only adapter for the travel data eSIM partner API (Airalo Partner API
 * shape). Credentials are optional: until they exist the app still renders the
 * storefront from the partner catalogue cache and blocks checkout with a clear
 * message instead of failing hard.
 */

export type EsimPackage = {
  id: string;
  title: string;
  region: string;
  countryCode: string | null;
  data: string;
  validityDays: number;
  /** Retail price in cents, markup already applied. */
  priceCents: number;
  operator: string;
  apn: string | null;
  isUnlimited: boolean;
};

export type ProvisionedSim = {
  orderId: string;
  iccid: string;
  activationCode: string | null;
  matchingId: string | null;
  smdpAddress: string | null;
  qrCodeUrl: string | null;
  apn: string | null;
  instructions: EsimInstructions;
};

export type EsimInstructions = {
  appleInstallUrl: string | null;
  confirmationCode: string | null;
};

export type SimUsage = {
  status: string;
  remainingMb: number | null;
  totalMb: number | null;
  expiresAt: string | null;
};

export class EsimProviderNotConfigured extends Error {
  constructor() {
    super(
      "Travel eSIM ordering is not connected yet. Add the eSIM partner credentials to start selling data plans.",
    );
  }
}

const BASE = () => process.env["AIRALO_BASE_URL"] || "https://partners.airalo.com";

export function esimProviderConfigured(): boolean {
  return Boolean(process.env["AIRALO_CLIENT_ID"] && process.env["AIRALO_CLIENT_SECRET"]);
}

function markup(): number {
  const raw = Number(process.env["ESIM_MARKUP_PERCENT"] ?? 25);
  return Number.isFinite(raw) && raw >= 0 && raw <= 200 ? raw : 25;
}

let cachedToken: { value: string; expiresAt: number } | null = null;

async function token(): Promise<string> {
  if (!esimProviderConfigured()) throw new EsimProviderNotConfigured();
  if (cachedToken && cachedToken.expiresAt > Date.now() + 60_000) return cachedToken.value;

  const body = new URLSearchParams({
    client_id: process.env["AIRALO_CLIENT_ID"]!,
    client_secret: process.env["AIRALO_CLIENT_SECRET"]!,
    grant_type: "client_credentials",
  });
  const res = await fetch(`${BASE()}/v2/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
    body,
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`eSIM partner auth failed [${res.status}]: ${text}`);
  const json = JSON.parse(text) as { data?: { access_token?: string; expires_in?: number } };
  const value = json.data?.access_token;
  if (!value) throw new Error("eSIM partner did not return an access token.");
  cachedToken = { value, expiresAt: Date.now() + (json.data?.expires_in ?? 3600) * 1000 };
  return value;
}

async function api<T>(
  path: string,
  init: { method?: "GET" | "POST"; body?: unknown; query?: Record<string, string> } = {},
): Promise<T> {
  const url = new URL(`${BASE()}${path}`);
  for (const [k, v] of Object.entries(init.query ?? {})) url.searchParams.set(k, v);
  const res = await fetch(url.toString(), {
    method: init.method ?? "GET",
    headers: {
      Authorization: `Bearer ${await token()}`,
      Accept: "application/json",
      ...(init.body ? { "Content-Type": "application/json" } : {}),
    },
    ...(init.body ? { body: JSON.stringify(init.body) } : {}),
  });
  const text = await res.text();
  if (!res.ok) {
    console.error(`eSIM partner ${path} -> ${res.status}: ${text}`);
    throw new Error(`The eSIM partner rejected that request (${res.status}).`);
  }
  return (text ? JSON.parse(text) : {}) as T;
}

type RawCatalogue = {
  data?: Array<{
    slug?: string;
    title?: string;
    country_code?: string | null;
    operators?: Array<{
      title?: string;
      apn_value?: string | null;
      packages?: Array<{
        id?: string;
        title?: string;
        type?: string;
        price?: number | string;
        amount?: number;
        day?: number;
        data?: string;
        is_unlimited?: boolean;
      }>;
    }>;
  }>;
};

function toCents(price: number | string | undefined): number {
  const value = typeof price === "string" ? Number(price) : (price ?? 0);
  const withMarkup = value * (1 + markup() / 100);
  // Round up to a tidy .99 style ending so the storefront reads like retail.
  return Math.max(99, Math.ceil(withMarkup * 100));
}

export async function fetchCatalogue(kind: "local" | "global"): Promise<EsimPackage[]> {
  const raw = await api<RawCatalogue>("/v2/packages", {
    query: { "filter[type]": kind, limit: "100", include: "topup" },
  });

  const out: EsimPackage[] = [];
  for (const entry of raw.data ?? []) {
    for (const operator of entry.operators ?? []) {
      for (const pkg of operator.packages ?? []) {
        if (!pkg.id) continue;
        out.push({
          id: pkg.id,
          title: pkg.title || `${entry.title ?? "Data plan"}`,
          region: entry.title ?? "Global",
          countryCode: entry.country_code ?? null,
          data: pkg.data || (pkg.is_unlimited ? "Unlimited" : "—"),
          validityDays: pkg.day ?? 0,
          priceCents: toCents(pkg.price),
          operator: operator.title ?? "Partner network",
          apn: operator.apn_value ?? null,
          isUnlimited: Boolean(pkg.is_unlimited),
        });
      }
    }
  }
  return out.sort((a, b) => a.region.localeCompare(b.region) || a.priceCents - b.priceCents);
}

export async function fetchPackage(packageId: string): Promise<EsimPackage | null> {
  const [local, global] = await Promise.all([fetchCatalogue("local"), fetchCatalogue("global")]);
  return [...local, ...global].find((p) => p.id === packageId) ?? null;
}

export async function placeOrder(packageId: string, reference: string): Promise<ProvisionedSim> {
  const raw = await api<{
    data?: {
      id?: number | string;
      code?: string;
      sims?: Array<{
        iccid?: string;
        lpa?: string;
        matching_id?: string;
        qrcode?: string;
        qrcode_url?: string;
        apn_value?: string;
        direct_apple_installation_url?: string;
        confirmation_code?: string;
      }>;
    };
  }>("/v2/orders", {
    method: "POST",
    body: { package_id: packageId, quantity: 1, type: "sim", description: reference },
  });

  const sim = raw.data?.sims?.[0];
  if (!sim?.iccid) throw new Error("The eSIM partner did not return a SIM profile.");

  const smdp = sim.lpa ?? null;
  const matching = sim.matching_id ?? null;
  return {
    orderId: String(raw.data?.id ?? raw.data?.code ?? ""),
    iccid: sim.iccid,
    activationCode: sim.qrcode ?? (smdp && matching ? `LPA:1$${smdp}$${matching}` : null),
    matchingId: matching,
    smdpAddress: smdp,
    qrCodeUrl: sim.qrcode_url ?? null,
    apn: sim.apn_value ?? null,
    instructions: {
      appleInstallUrl: sim.direct_apple_installation_url ?? null,
      confirmationCode: sim.confirmation_code ?? null,
    },
  };
}

export async function fetchUsage(iccid: string): Promise<SimUsage> {
  const raw = await api<{
    data?: {
      status?: string;
      remaining?: number;
      total?: number;
      expired_at?: string;
    };
  }>(`/v2/sims/${encodeURIComponent(iccid)}/usage`);
  return {
    status: raw.data?.status ?? "unknown",
    remainingMb: raw.data?.remaining ?? null,
    totalMb: raw.data?.total ?? null,
    expiresAt: raw.data?.expired_at ?? null,
  };
}
