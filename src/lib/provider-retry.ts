/**
 * Retries transient provider failures (rate limits, outages, dropped
 * connections) with growing waits. Creates (POST) only retry on 429, where the
 * provider guarantees nothing was processed, so a retry can never send a text
 * or place a call twice.
 */
export type RetryOptions = {
  method?: string;
  attempts?: number;
  baseDelayMs?: number;
  sleep?: (ms: number) => Promise<void>;
};

const IDEMPOTENT = new Set(["GET", "HEAD", "DELETE", "PUT", "PATCH"]);

export function shouldRetry(method: string, status: number | null): boolean {
  if (status === 429) return true;
  if (!IDEMPOTENT.has(method.toUpperCase())) return false;
  return status === null || status >= 500;
}

export function backoffDelay(attempt: number, baseDelayMs = 300): number {
  return baseDelayMs * 2 ** attempt;
}

export async function fetchWithRetry(
  doFetch: () => Promise<Response>,
  opts: RetryOptions = {},
): Promise<Response> {
  const method = (opts.method ?? "GET").toUpperCase();
  const attempts = opts.attempts ?? 3;
  const sleep = opts.sleep ?? ((ms: number) => new Promise((r) => setTimeout(r, ms)));
  let lastError: unknown;
  for (let attempt = 0; attempt < attempts; attempt++) {
    try {
      const response = await doFetch();
      if (response.ok || attempt === attempts - 1 || !shouldRetry(method, response.status)) {
        return response;
      }
      const retryAfter = Number(response.headers.get("retry-after"));
      await sleep(
        Number.isFinite(retryAfter) && retryAfter > 0
          ? Math.min(retryAfter * 1000, 5000)
          : backoffDelay(attempt, opts.baseDelayMs),
      );
    } catch (error) {
      lastError = error;
      if (attempt === attempts - 1 || !shouldRetry(method, null)) throw error;
      await sleep(backoffDelay(attempt, opts.baseDelayMs));
    }
  }
  throw lastError ?? new Error("Provider request failed");
}

/** Record a failed provider update so it shows up as an alert in Platform → Health. */
export async function recordProviderFailure(input: {
  provider: "twilio" | "elevenlabs";
  method: string;
  path: string;
  status: number | null;
  body: string;
}): Promise<void> {
  if (input.method.toUpperCase() === "GET") return;
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("webhook_errors").insert({
      source: `${input.provider}-api`,
      error_code: input.status ? String(input.status) : "network",
      message: `${input.method.toUpperCase()} ${input.path.replace(/\?.*$/, "")} failed: ${input.body.slice(0, 500)}`,
      workspace_id: null,
      payload: {} as never,
    });
  } catch (error) {
    console.error("Failed to record provider failure", error);
  }
}
