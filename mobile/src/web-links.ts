/** Screens that stay on the web admin. The native app only deep-links to them. */
export const WEB_LINKS = [
  { label: "Numbers", path: "/numbers", detail: "Claim, assign, and forward lines" },
  { label: "AI receptionist", path: "/receptionist", detail: "Greeting, hours, and voice" },
  { label: "Billing", path: "/billing", detail: "Plan and invoices" },
  { label: "Contacts", path: "/contacts", detail: "Customer records" },
  { label: "Insights", path: "/insights", detail: "Call reports" },
  { label: "Registration", path: "/a2p", detail: "A2P 10DLC texting approval" },
  { label: "All settings", path: "/settings", detail: "Everything else in the web app" },
] as const;

export function webUrl(origin: string, path: string): string {
  const base = origin.replace(/\/$/, "");
  const suffix = path.startsWith("/") ? path : `/${path}`;
  return `${base}${suffix}`;
}
