export type AppEnvironment = "development" | "staging" | "production";

/** Which SixVox stack this process is serving. Defaults keep production unchanged. */
export function appEnvironment(): AppEnvironment {
  const explicit = process.env["SIXVOX_ENV"]?.trim().toLowerCase();
  if (explicit === "staging" || explicit === "production" || explicit === "development") {
    return explicit;
  }
  if (process.env["NODE_ENV"] === "production") return "production";
  return "development";
}

/** Public origin for webhooks, ringback audio, and links. Override per environment. */
export function publicBaseUrl(): string {
  const configured = process.env["PUBLIC_BASE_URL"]?.trim();
  if (configured) return configured.replace(/\/$/, "");
  return "https://sixvox.3bi.io";
}
