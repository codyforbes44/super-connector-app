import { BRAND, button, escapeHtml, layout, metaTable, paragraph, quote } from "./layout";

export type RenderedEmail = { subject: string; html: string };

export type TemplateName =
  | "missed-call"
  | "voicemail"
  | "inbound-message"
  | "ai-summary"
  | "account"
  | "daily-digest"
  | "weekly-missed"
  | "test";

const appLink = (base: string, path: string) => `${base.replace(/\/$/, "")}${path}`;

export type MissedCallData = {
  baseUrl: string;
  from: string;
  to: string;
  at: string;
  duration?: string;
  location?: string;
  callSid?: string;
};

export function missedCall(d: MissedCallData): RenderedEmail {
  const body =
    paragraph(`<strong>${escapeHtml(d.from)}</strong> called and didn't get through.`) +
    metaTable([
      { label: "From", value: d.from },
      { label: "Called", value: d.to },
      { label: "When", value: d.at },
      { label: "Location", value: d.location ?? "" },
      { label: "Call SID", value: d.callSid ?? "" },
    ]) +
    button("Call back", appLink(d.baseUrl, "/calls")) +
    paragraph(
      `<span style="color:${BRAND.muted};font-size:13px;">Tap to open the dialer with this number ready.</span>`,
    );
  return {
    subject: `SixVox · Missed call from ${d.from}`,
    html: layout({
      preheader: `${d.from} called ${d.to}`,
      eyebrow: "Missed call",
      title: d.from,
      body,
    }),
  };
}

export type VoicemailData = MissedCallData & { transcript?: string; recordingUrl?: string };

export function voicemail(d: VoicemailData): RenderedEmail {
  const body =
    paragraph(`<strong>${escapeHtml(d.from)}</strong> left a voicemail.`) +
    (d.transcript ? quote(d.transcript) : "") +
    metaTable([
      { label: "From", value: d.from },
      { label: "Called", value: d.to },
      { label: "When", value: d.at },
      { label: "Duration", value: d.duration ?? "" },
      { label: "Location", value: d.location ?? "" },
    ]) +
    button("Listen in SixVox", appLink(d.baseUrl, "/calls"));
  return {
    subject: `SixVox · Voicemail from ${d.from}`,
    html: layout({
      preheader: d.transcript ? d.transcript.slice(0, 120) : `${d.from} left a voicemail`,
      eyebrow: "New voicemail",
      title: d.from,
      body,
    }),
  };
}

export type InboundMessageData = {
  baseUrl: string;
  channel: string;
  from: string;
  to: string;
  at: string;
  preview: string;
  conversationId: string;
  mediaCount?: number;
};

export function inboundMessage(d: InboundMessageData): RenderedEmail {
  const label = d.channel === "whatsapp" ? "WhatsApp" : "SMS";
  const body =
    paragraph(`New ${label} message from <strong>${escapeHtml(d.from)}</strong>.`) +
    quote(d.preview || (d.mediaCount ? `${d.mediaCount} attachment(s)` : "(no text)")) +
    metaTable([
      { label: "From", value: d.from },
      { label: "To", value: d.to },
      { label: "Channel", value: label },
      { label: "When", value: d.at },
    ]) +
    button("Open thread", appLink(d.baseUrl, `/inbox/${d.conversationId}`));
  return {
    subject: `SixVox · ${label} from ${d.from}: ${(d.preview || "new message").slice(0, 60)}`,
    html: layout({
      preheader: d.preview.slice(0, 120),
      eyebrow: `New ${label.toLowerCase()}`,
      title: d.from,
      body,
    }),
  };
}

export type AiSummaryData = {
  baseUrl: string;
  from: string;
  to: string;
  at: string;
  summary: string;
  turns: Array<{ role: string; message: string }>;
  booking?: { summary: string; when: string; link?: string };
};

export function aiSummary(d: AiSummaryData): RenderedEmail {
  const transcript = d.turns
    .slice(0, 30)
    .map(
      (t) => `
      <tr><td style="padding:6px 0;vertical-align:top;width:76px;font:600 11px/1.6 -apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;letter-spacing:.06em;text-transform:uppercase;color:${t.role === "agent" ? BRAND.accent : BRAND.muted};">${escapeHtml(t.role)}</td>
      <td style="padding:6px 0;font:400 14px/1.6 -apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:${BRAND.ink};">${escapeHtml(t.message)}</td></tr>`,
    )
    .join("");

  const body =
    paragraph(`Your AI assistant handled a call from <strong>${escapeHtml(d.from)}</strong>.`) +
    (d.summary ? quote(d.summary) : "") +
    (d.booking
      ? paragraph(
          `📅 Booked: <strong>${escapeHtml(d.booking.summary)}</strong> — ${escapeHtml(d.booking.when)}` +
            (d.booking.link
              ? ` · <a href="${escapeHtml(d.booking.link)}" style="color:#0e5f6b;">view event</a>`
              : ""),
        )
      : "") +
    metaTable([
      { label: "Caller", value: d.from },
      { label: "Number", value: d.to },
      { label: "When", value: d.at },
      { label: "Turns", value: String(d.turns.length) },
    ]) +
    (transcript
      ? `<div style="margin-top:18px;font:600 11px/1 -apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;letter-spacing:.14em;text-transform:uppercase;color:${BRAND.muted};">Transcript</div>
         <table role="presentation" width="100%" cellpadding="0" cellspacing="0">${transcript}</table>`
      : "") +
    button("Open call", appLink(d.baseUrl, "/calls"));

  return {
    subject: `SixVox · AI receptionist handled a call from ${d.from}`,
    html: layout({
      preheader: d.summary.slice(0, 120) || "AI assistant call summary",
      eyebrow: "AI assistant",
      title: `Call summary — ${d.from}`,
      body,
    }),
  };
}

export type AccountData = {
  baseUrl: string;
  kind: "welcome" | "invite" | "number-provisioned" | "usage-warning";
  displayName?: string;
  detail?: string;
  ctaLabel?: string;
  ctaPath?: string;
  rows?: Array<{ label: string; value: string }>;
};

export function account(d: AccountData): RenderedEmail {
  const copy: Record<AccountData["kind"], { eyebrow: string; title: string; intro: string }> = {
    welcome: {
      eyebrow: "Welcome",
      title: `Welcome to ${BRAND.name}`,
      intro: `You're all set. SixVox puts your calls, texts, WhatsApp and AI assistants in one place.`,
    },
    invite: {
      eyebrow: "Team invite",
      title: `You've been invited to ${BRAND.name}`,
      intro: `You now have access to the team workspace. Sign in to start handling calls and messages.`,
    },
    "number-provisioned": {
      eyebrow: "Numbers",
      title: "A new number is live",
      intro: `A phone number was added to your workspace and is ready to send and receive.`,
    },
    "usage-warning": {
      eyebrow: "Usage",
      title: "Usage needs your attention",
      intro: `Your account is approaching a limit. Review usage to avoid interrupted service.`,
    },
  };
  const c = copy[d.kind];
  const body =
    paragraph(d.displayName ? `Hi ${escapeHtml(d.displayName)},` : "Hi there,") +
    paragraph(escapeHtml(c.intro)) +
    (d.detail ? quote(d.detail) : "") +
    (d.rows?.length ? metaTable(d.rows) : "") +
    button(d.ctaLabel ?? "Open SixVox", appLink(d.baseUrl, d.ctaPath ?? "/inbox"));
  return {
    subject: `SixVox · ${c.title}`,
    html: layout({ preheader: c.intro, eyebrow: c.eyebrow, title: c.title, body }),
  };
}

export type DigestData = {
  baseUrl: string;
  rangeLabel: string;
  threads: Array<{ from: string; preview: string; id: string }>;
  calls: Array<{ from: string; at: string; kind: string }>;
};

export function dailyDigest(d: DigestData): RenderedEmail {
  const threadRows = d.threads
    .map(
      (
        t,
      ) => `<tr><td style="padding:10px 0;border-bottom:1px solid ${BRAND.line};font:400 14px/1.5 -apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:${BRAND.ink};">
      <a href="${escapeHtml(appLink(d.baseUrl, `/inbox/${t.id}`))}" style="color:${BRAND.ink};text-decoration:none;"><strong>${escapeHtml(t.from)}</strong><br/>
      <span style="color:${BRAND.muted};font-size:13px;">${escapeHtml(t.preview.slice(0, 90))}</span></a></td></tr>`,
    )
    .join("");
  const callRows = d.calls
    .map(
      (c) =>
        `<tr><td style="padding:8px 0;border-bottom:1px solid ${BRAND.line};font:400 14px/1.5 -apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:${BRAND.ink};">${escapeHtml(c.from)} <span style="color:${BRAND.muted};font-size:12px;">· ${escapeHtml(c.kind)} · ${escapeHtml(c.at)}</span></td></tr>`,
    )
    .join("");

  const body =
    paragraph(`Here's what happened ${escapeHtml(d.rangeLabel)}.`) +
    (threadRows
      ? `<div style="margin-top:14px;font:600 11px/1 -apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;letter-spacing:.14em;text-transform:uppercase;color:${BRAND.muted};">Unread threads (${d.threads.length})</div><table role="presentation" width="100%">${threadRows}</table>`
      : "") +
    (callRows
      ? `<div style="margin-top:20px;font:600 11px/1 -apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;letter-spacing:.14em;text-transform:uppercase;color:${BRAND.muted};">Calls needing attention (${d.calls.length})</div><table role="presentation" width="100%">${callRows}</table>`
      : "") +
    (!threadRows && !callRows ? paragraph("Nothing needs your attention. Inbox zero.") : "") +
    button("Open SixVox", appLink(d.baseUrl, "/inbox"));

  return {
    subject: `SixVox digest — ${d.threads.length} unread, ${d.calls.length} calls`,
    html: layout({
      preheader: `${d.threads.length} unread threads · ${d.calls.length} calls`,
      eyebrow: "Daily digest",
      title: "Your SixVox digest",
      body,
    }),
  };
}

export type WeeklyMissedData = {
  baseUrl: string;
  rangeLabel: string;
  missed: Array<{ from: string; at: string; summary: string }>;
  booked: Array<{ summary: string; when: string; contact: string }>;
};

export function weeklyMissed(d: WeeklyMissedData): RenderedEmail {
  const missedRows = d.missed
    .map(
      (row) =>
        `<tr><td style="padding:8px 0;border-bottom:1px solid ${BRAND.line};font:400 14px/1.5 -apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:${BRAND.ink};"><strong>${escapeHtml(row.from)}</strong><br/><span style="color:${BRAND.muted};font-size:13px;">${escapeHtml(row.summary)} · ${escapeHtml(row.at)}</span></td></tr>`,
    )
    .join("");
  const bookedRows = d.booked
    .map(
      (row) =>
        `<tr><td style="padding:8px 0;border-bottom:1px solid ${BRAND.line};font:400 14px/1.5 -apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:${BRAND.ink};"><strong>${escapeHtml(row.summary)}</strong><br/><span style="color:${BRAND.muted};font-size:13px;">${escapeHtml(row.when)} · ${escapeHtml(row.contact)}</span></td></tr>`,
    )
    .join("");
  const body =
    paragraph(
      `Calls you would have missed ${escapeHtml(d.rangeLabel)}, and the jobs that got booked.`,
    ) +
    (missedRows
      ? `<div style="margin-top:14px;font:600 11px/1 -apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;letter-spacing:.14em;text-transform:uppercase;color:${BRAND.muted};">Calls you would have missed (${d.missed.length})</div><table role="presentation" width="100%">${missedRows}</table>`
      : paragraph("No missed calls this week.")) +
    (bookedRows
      ? `<div style="margin-top:20px;font:600 11px/1 -apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;letter-spacing:.14em;text-transform:uppercase;color:${BRAND.muted};">Booked jobs (${d.booked.length})</div><table role="presentation" width="100%">${bookedRows}</table>`
      : "") +
    button("Open calls", appLink(d.baseUrl, "/calls"));
  return {
    subject: `SixVox · Calls you would have missed (${d.missed.length})`,
    html: layout({
      preheader: `${d.missed.length} missed calls · ${d.booked.length} booked jobs`,
      eyebrow: "Weekly report",
      title: "Calls you would have missed",
      body,
    }),
  };
}

export function testEmail(baseUrl: string): RenderedEmail {
  const body =
    paragraph("This is a test email from SixVox.") +
    paragraph(
      `If it landed in your inbox, sending from <strong>${BRAND.domain}</strong> is working correctly.`,
    ) +
    metaTable([
      { label: "Sender domain", value: BRAND.domain },
      { label: "Sent", value: new Date().toUTCString() },
    ]) +
    button("Open SixVox", appLink(baseUrl, "/settings"));
  return {
    subject: "SixVox test email",
    html: layout({
      preheader: "Email delivery is working.",
      eyebrow: "Test",
      title: "Email delivery works",
      body,
    }),
  };
}
