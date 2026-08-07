import { getRequest } from "@tanstack/react-start/server";

/** Absolute URL for a same-origin path, derived from the current request. */
export function absoluteUrl(path: string): string {
  const request = getRequest();
  if (!request) throw new Error("No active request context.");
  return new URL(path, request.url).toString();
}
