import { PLANS } from "@/lib/plans";

/**
 * Competitor facts copied from the Sep 26, 2026 product plan, section 3.
 * Do not add prices or counts that are not in those tables.
 * SixVox's own dollar amounts come from the plans config (the live prices).
 */

const soloPlan = PLANS.find((plan) => plan.code === "solo");
const teamPlan = PLANS.find((plan) => plan.code === "team");

export const PRICE_AS_OF = "List prices as of Sep 2026";

export type CompareLink = { label: string; href: string };

/** Sources listed at the end of the product plan. */
export const COMPARE_SOURCES: CompareLink[] = [
  { label: "SixVox site", href: "https://sixvox.3bi.io" },
  { label: "SixVox pricing", href: "https://sixvox.3bi.io/pricing" },
  { label: "Quo pricing", href: "https://www.quo.com/pricing" },
  {
    label: "Quo Sona pricing",
    href: "https://support.quo.com/core-concepts/ai-automations/sona/sona-pricing",
  },
  {
    label: "Quo plan table",
    href: "https://support.quo.com/core-concepts/administration/billing/pricing",
  },
  {
    label: "Quo call-quality thread",
    href: "https://www.reddit.com/r/quo/comments/1twktw4/has_anyone_else_noticed_call_quality_isnt_that/",
  },
  {
    label: "Quo alternatives thread",
    href: "https://www.reddit.com/r/PhoneSystem/comments/1obogqn/quo_openphone_is_terrible_alternatives/",
  },
  { label: "Dialpad pricing", href: "https://www.dialpad.com/pricing/" },
  { label: "Grasshopper pricing", href: "https://grasshopper.com/pricing" },
  {
    label: "Google Voice billing",
    href: "https://knowledge.workspace.google.com/admin/voice/how-voice-billing-works",
  },
  {
    label: "Google Voice automated texting",
    href: "https://support.google.com/voice/answer/9249103?hl=en",
  },
  { label: "Google Voice product", href: "https://workspace.google.com/products/voice/" },
  {
    label: "Google Voice limits",
    href: "https://support.google.com/voice/answer/9230450?hl=en",
  },
  {
    label: "RingCentral plans",
    href: "https://www.ringcentral.com/office/plansandpricing.html",
  },
  {
    label: "RingCentral AI Receptionist",
    href: "https://www.ringcentral.com/pricing/ai-receptionist.html",
  },
  { label: "Aircall pricing", href: "https://aircall.io/pricing/" },
  { label: "Rosie pricing", href: "https://heyrosie.com/pricing" },
  { label: "Goodcall pricing", href: "https://www.goodcall.com/pricing" },
  { label: "Smith.ai AI receptionist pricing", href: "https://smith.ai/pricing/ai-receptionist" },
  { label: "Sameday pricing", href: "https://sameday.ai/pricing" },
  { label: "Avoca ServiceTitan", href: "https://www.avoca.ai/integrations/servicetitan" },
  { label: "Jobber pricing", href: "https://www.getjobber.com/pricing/" },
  {
    label: "Jobber Receptionist help",
    href: "https://help.getjobber.com/en/articles/receptionistpowered-by-jobber-ai/",
  },
  {
    label: "Jobber AI receptionist",
    href: "https://www.getjobber.com/features/ai-receptionist/",
  },
  { label: "Housecall Pro pricing", href: "https://www.housecallpro.com/pricing/" },
  {
    label: "Housecall Pro CSR AI",
    href: "https://help.housecallpro.com/en/articles/9740104-csr-ai-overview",
  },
  {
    label: "ServiceTitan Voice Agent FAQ",
    href: "https://help.servicetitan.com/docs/ai-voice-agent-for-basic-phones-and-phones-pro-faq",
  },
  {
    label: "Twilio unregistered sender (error 30125)",
    href: "https://www.twilio.com/docs/api/errors/30125",
  },
  { label: "ElevenLabs Agents pricing", href: "https://elevenlabs.io/pricing/agents" },
  {
    label: "FCC VoIP 911 rules (47 CFR part 9)",
    href: "https://www.ecfr.gov/current/title-47/chapter-I/subchapter-A/part-9/subpart-D",
  },
  { label: "FCC 911 dispatchable location", href: "https://www.fcc.gov/911-dispatchable-location" },
];

export type CostRow = {
  setup: string;
  monthly: string;
  gets: string;
  href: string;
};

/**
 * Section 3.3, limited to Quo, Grasshopper, and Jobber Receptionist.
 * Google Voice is omitted here because section 3.3 does not price it.
 * SixVox dollar amounts come from the plans config. The old "Team required
 * for AI" row is not the offer anymore.
 */
export const SOLO_COST_ROWS: CostRow[] = [
  {
    setup: "SixVox Solo",
    monthly: `$${soloPlan?.monthly ?? ""}`,
    gets: "1 number, 1 seat. AI receptionist is included on Solo.",
    href: "/pricing",
  },
  {
    setup: "SixVox Team",
    monthly: `$${teamPlan?.monthly ?? ""}`,
    gets: "3 numbers, 5 seats, AI answering included.",
    href: "/pricing",
  },
  {
    setup: "Quo Starter + Sona Tier 2",
    monthly: "$19 + $25 = $44",
    gets: "~40 AI calls; summaries only on Sona calls",
    href: "https://www.quo.com/pricing",
  },
  {
    setup: "Grasshopper True Solo",
    monthly: "$18",
    gets: "No AI receptionist; missed-call text only",
    href: "https://grasshopper.com/pricing",
  },
  {
    setup: "Jobber Core + Receptionist",
    monthly: "$49 + $29 = $78 ($58 yearly)",
    gets: "30 AI conversations + a full FSM",
    href: "https://www.getjobber.com/pricing/",
  },
];

export type MatrixRow = {
  capability: string;
  sixvox: string;
  quo: string;
  grasshopper: string;
  googleVoice: string;
  jobber: string;
};

/**
 * Section 3.1 cells for Quo, Grasshopper, and Google Voice, copied as written
 * ("n/v" included). Jobber cells come only from sections 3.2 and 3.3.
 * SixVox cells follow section 3.1 except the contradictions section 2
 * says to fix, plus later shipped line controls: text-back, business-hours
 * routing, approval booking, E911 address registration, per-workspace roles,
 * review requests, payment links, Spanish answering, and Jobber (connect under
 * Integrations, then create or match a client and request from a call thread).
 * Competitor cells on the newer rows were not in those tables, so they stay unverified.
 */
export const CAPABILITY_ROWS: MatrixRow[] = [
  {
    capability: "Entry price",
    sixvox: `$${soloPlan?.monthly ?? ""} (1 number, 1 seat). Team is $${teamPlan?.monthly ?? ""}.`,
    quo: "$19/user ($15/yr)",
    grasshopper: "$18 True Solo ($14/yr)",
    googleVoice: "$10 standalone; $10/user + Workspace",
    jobber:
      "$29/mo add-on, 30 conversations, $0.79 after; unlimited on Plus. Needs a Jobber plan (Core from $29/mo yearly) and a Jobber number. Core + Receptionist is $49 + $29 = $78 month-to-month ($58 yearly).",
  },
  {
    capability: "AI receptionist",
    sixvox: "Yes (ElevenLabs), included on every plan including Solo",
    quo: "Sona: ~10 calls free, then $25/40 calls",
    grasshopper: "Virtual Receptionist add-on, from $95 (3rd party)",
    googleVoice: "No",
    jobber: "$29/mo add-on, 30 conversations, $0.79 after; unlimited on Plus",
  },
  {
    capability: "AI call summaries",
    sixvox: "AI calls; transcripts when transcription is on",
    quo: "Business+ (Starter: Sona calls only)",
    grasshopper: "Solo Plus+",
    googleVoice: "Standard ($20)+",
    jobber: "Not stated in the Sep 2026 sources used here",
  },
  {
    capability: "Spanish answering",
    sixvox:
      "Per line, on the receptionist number sheet or in line settings: English only, Spanish only, or Auto-detect. Spanish only updates the AI agent prompt language. Auto-detect keeps the agent language in English and instructs a switch when the caller speaks Spanish. Default missed-call text-back and booking texts can use Spanish when the line is Spanish, or when auto and the transcript is Spanish. A custom template stays as saved.",
    quo: "n/v",
    grasshopper: "n/v",
    googleVoice: "n/v",
    jobber: "Not stated in the Sep 2026 sources used here",
  },
  {
    capability: "Missed-call auto text",
    sixvox:
      "Included on every plan. Turn it on in line settings; an unanswered inbound call then gets a text from that line.",
    quo: "Yes (auto-replies)",
    grasshopper: "Yes (Instant Response)",
    googleVoice: "n/v",
    jobber: "Hang-up text-back",
  },
  {
    capability: "Books into calendar",
    sixvox:
      "Google Calendar. Approval booking is in line settings: you approve the time before the customer is texted. Automatic booking is optional.",
    quo: "Not stated for Sona",
    grasshopper: "No",
    googleVoice: "No",
    jobber: "Yes, via Jobber online booking",
  },
  {
    capability: "Shared inbox + roles",
    sixvox: "Yes. Roles are per workspace (owner, admin, agent).",
    quo: "Yes",
    grasshopper: "Solo Plus+ (unlimited users)",
    googleVoice: "Ring groups on Standard",
    jobber: "Needs a Jobber plan and a Jobber number — not a standalone inbox",
  },
  {
    capability: "Native iOS/Android calling",
    sixvox: "No iOS app; Android TWA; web push only. A native app is coming soon.",
    quo: "Yes",
    grasshopper: "Yes",
    googleVoice: "Yes",
    jobber: "Not stated in the Sep 2026 sources used here",
  },
  {
    capability: "CRM / FSM integrations",
    sixvox:
      "Gmail, Calendar, Maps. Connect Jobber under Integrations, then create or match a client and request from a call thread. Connect stays off until JOBBER_CLIENT_ID and JOBBER_CLIENT_SECRET are set. Tokens stay on the server.",
    quo: "HubSpot, Salesforce, Jobber, Zapier, Make, webhooks (beta)",
    grasshopper: "n/v",
    googleVoice: "Google Workspace",
    jobber: "It is the Jobber product. A call can book through Jobber online booking.",
  },
  {
    capability: "Porting",
    sixvox: "Forwarding built; port-in flow not productized (coming soon)",
    quo: "Free",
    grasshopper: "Yes",
    googleVoice: "Yes",
    jobber: "Not stated in the Sep 2026 sources used here",
  },
  {
    capability: "10DLC handled",
    sixvox: "In-app flow on every plan. The Sep 2026 review found 0 completed registrations.",
    quo: "Yes; $19.50 + $1.50–3/mo passed through",
    grasshopper: "$19.50 + $1.50/mo",
    googleVoice: "No 10DLC; automated texting banned",
    jobber: "Not stated in the Sep 2026 sources used here",
  },
  {
    capability: "E911",
    sixvox:
      "Address registration and a dialer disclosure are in the app. A number is covered after you register its service address.",
    quo: "n/v",
    grasshopper: "n/v",
    googleVoice: "n/v",
    jobber: "Not stated in the Sep 2026 sources used here",
  },
  {
    capability: "Review requests",
    sixvox:
      "Mark job done on a thread. If review requests are on and a Google review link is saved in Integrations, SixVox texts that link. Quiet hours, a per-contact cooldown, and STOP are checked first.",
    quo: "n/v",
    grasshopper: "n/v",
    googleVoice: "n/v",
    jobber: "Not stated in the Sep 2026 sources used here",
  },
  {
    capability: "Payment links",
    sixvox:
      "From a conversation, open Payment link and text an amount. Stripe Connect is test mode. The charge is created on the connected account, not on SixVox.",
    quo: "n/v",
    grasshopper: "n/v",
    googleVoice: "n/v",
    jobber: "Not stated in the Sep 2026 sources used here",
  },
];

export const JOBBER_NOTES = [
  "Target: Jobber users.",
  "Books jobs via Jobber online booking.",
  "Calls and texts, hang-up text-back, keyword escalation.",
  "Not a standalone business line. It needs a Jobber plan and a Jobber dedicated number.",
] as const;
