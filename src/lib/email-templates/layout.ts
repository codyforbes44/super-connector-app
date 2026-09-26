/**
 * Shared HTML shell for every SixVox email.
 * Table-based, inline-styled, light body (inbox-safe) with a Midnight Dialer
 * gradient header so it still feels like the app.
 */

export const BRAND = {
  name: "SixVox",
  domain: "bookme.bet",
  gradient: "linear-gradient(135deg,#0b1b34 0%,#123a5c 55%,#0e5f6b 100%)",
  accent: "#3ddad7",
  ink: "#0b1b34",
  muted: "#5b6b80",
  line: "#e4e9f0",
  page: "#f4f7fb",
};

export function escapeHtml(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export type MetaRow = { label: string; value: string };

export function metaTable(rows: MetaRow[]): string {
  const cells = rows
    .filter((r) => r.value)
    .map(
      (r) => `
      <tr>
        <td style="padding:10px 0;border-bottom:1px solid ${BRAND.line};font:500 12px/1.4 -apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;letter-spacing:.06em;text-transform:uppercase;color:${BRAND.muted};white-space:nowrap;">${escapeHtml(r.label)}</td>
        <td align="right" style="padding:10px 0;border-bottom:1px solid ${BRAND.line};font:600 14px/1.5 ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;color:${BRAND.ink};">${escapeHtml(r.value)}</td>
      </tr>`,
    )
    .join("");
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:8px 0 4px;">${cells}</table>`;
}

export function button(label: string, href: string): string {
  return `
  <table role="presentation" cellpadding="0" cellspacing="0" style="margin:22px 0 4px;">
    <tr><td align="center" bgcolor="${BRAND.ink}" style="border-radius:999px;">
      <a href="${escapeHtml(href)}" style="display:inline-block;padding:13px 28px;border-radius:999px;background:${BRAND.gradient};color:#ffffff;font:600 14px/1 -apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;text-decoration:none;">${escapeHtml(label)}</a>
    </td></tr>
  </table>`;
}

export function quote(text: string): string {
  return `<div style="margin:16px 0;padding:14px 16px;border-left:3px solid ${BRAND.accent};background:#f7fbfc;border-radius:0 12px 12px 0;font:400 15px/1.6 -apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:${BRAND.ink};white-space:pre-wrap;">${escapeHtml(text)}</div>`;
}

export function paragraph(text: string): string {
  return `<p style="margin:0 0 12px;font:400 15px/1.65 -apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:${BRAND.ink};">${text}</p>`;
}

export function layout(opts: {
  preheader: string;
  eyebrow: string;
  title: string;
  body: string;
  footerNote?: string;
}): string {
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/>
<meta name="color-scheme" content="light"/><title>${escapeHtml(opts.title)}</title></head>
<body style="margin:0;padding:0;background:${BRAND.page};">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;">${escapeHtml(opts.preheader)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${BRAND.page};padding:28px 12px;">
  <tr><td align="center">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:20px;overflow:hidden;box-shadow:0 12px 32px rgba(11,27,52,.10);">
      <tr><td style="background:${BRAND.ink};background-image:${BRAND.gradient};padding:26px 28px;">
        <div data-sb="eyebrow" style="font:600 11px/1 -apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;letter-spacing:.18em;text-transform:uppercase;color:${BRAND.accent};">${escapeHtml(opts.eyebrow)}</div>
        <div data-sb="title" style="margin-top:10px;font:700 22px/1.3 -apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#ffffff;">${escapeHtml(opts.title)}</div>
      </td></tr>
      <tr><td style="padding:26px 28px 30px;"><div data-sb="intro"></div>${opts.body}<div data-sb="outro"></div></td></tr>
      <tr><td style="padding:18px 28px 26px;border-top:1px solid ${BRAND.line};">
        <div style="font:400 12px/1.6 -apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:${BRAND.muted};">
          ${escapeHtml(opts.footerNote ?? `Sent by ${BRAND.name} · ${BRAND.domain}`)}<br/>
          You can change which alerts you receive in SixVox → Settings → Notifications.
        </div>
      </td></tr>
    </table>
  </td></tr>
</table>
</body></html>`;
}

export function toPlainText(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/g, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();
}
