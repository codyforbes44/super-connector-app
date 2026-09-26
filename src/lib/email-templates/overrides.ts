import type { RenderedEmail, TemplateName } from "./index";
import { paragraph } from "./layout";

export type TemplateOverride = {
  template: string;
  subject: string | null;
  eyebrow: string | null;
  headline: string | null;
  intro: string | null;
  outro: string | null;
  enabled: boolean;
};

/** Copy fields a user can edit for each template, plus the variables they can use. */
export const TEMPLATE_CATALOG: Array<{
  template: TemplateName;
  label: string;
  description: string;
  variables: string[];
}> = [
  {
    template: "missed-call",
    label: "Missed call",
    description: "Sent when an inbound call isn't answered.",
    variables: ["from", "to", "at"],
  },
  {
    template: "voicemail",
    label: "Voicemail",
    description: "Sent when a caller leaves a voicemail.",
    variables: ["from", "to", "at", "duration"],
  },
  {
    template: "inbound-message",
    label: "Inbound message",
    description: "Sent for new SMS / MMS / WhatsApp messages.",
    variables: ["from", "to", "channel", "preview"],
  },
  {
    template: "ai-summary",
    label: "AI call summary",
    description: "Sent after the AI assistant handles a call.",
    variables: ["from", "to", "at", "summary"],
  },
  {
    template: "account",
    label: "Account & onboarding",
    description: "Welcome, invite, number provisioned and usage notices.",
    variables: ["displayName", "detail"],
  },
  {
    template: "daily-digest",
    label: "Daily digest",
    description: "Rollup of unread threads and calls.",
    variables: ["rangeLabel"],
  },
  {
    template: "test",
    label: "Test email",
    description: "Delivery test from Settings.",
    variables: [],
  },
];

function escapeHtml(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function interpolate(text: string, vars: Record<string, unknown>): string {
  return text.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_m, key: string) => {
    const value = vars[key];
    return value === undefined || value === null ? "" : String(value);
  });
}

function replaceSlot(html: string, slot: string, inner: string): string {
  const re = new RegExp(`(<div data-sb="${slot}"[^>]*>)([\\s\\S]*?)(</div>)`);
  return html.replace(re, (_m, open: string, _old: string, close: string) => open + inner + close);
}

/** Apply a saved copy override to a rendered email. Branding/layout stay fixed. */
export function applyOverride(
  rendered: RenderedEmail,
  override: TemplateOverride | null | undefined,
  vars: Record<string, unknown> = {},
): RenderedEmail {
  if (!override || !override.enabled) return rendered;

  let subject = rendered.subject;
  let html = rendered.html;

  if (override.subject?.trim()) subject = interpolate(override.subject, vars);
  if (override.eyebrow?.trim()) {
    html = replaceSlot(html, "eyebrow", escapeHtml(interpolate(override.eyebrow, vars)));
  }
  if (override.headline?.trim()) {
    html = replaceSlot(html, "title", escapeHtml(interpolate(override.headline, vars)));
  }
  if (override.intro?.trim()) {
    html = replaceSlot(html, "intro", paragraph(escapeHtml(interpolate(override.intro, vars))));
  }
  if (override.outro?.trim()) {
    html = replaceSlot(html, "outro", paragraph(escapeHtml(interpolate(override.outro, vars))));
  }
  return { subject, html };
}
