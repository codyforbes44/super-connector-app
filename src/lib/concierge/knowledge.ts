/**
 * Source of truth for what the SixVox concierge knows.
 *
 * These documents are uploaded to the ElevenLabs agent's knowledge base and
 * are also summarised into the system prompt, so the agent can answer without
 * a retrieval round trip for the most common questions.
 */

import {
  FEATURE_MATRIX,
  PLANS,
  RECORDING_CLAIM,
  TRIAL_DAYS,
  TRIAL_LIMITS,
  featureLabel,
} from "@/lib/plans";

export type KnowledgeDoc = { name: string; text: string };

function planLines(): string {
  return PLANS.map((plan) => {
    return [
      `${plan.name} (code ${plan.code}) — $${plan.monthly}/month or $${plan.yearly}/year.`,
      `${plan.tagline} Includes ${plan.numbers} phone number(s), ${plan.seats} seat(s), and ${plan.aiCalls} AI receptionist calls.`,
      `Features: ${plan.features.map(featureLabel).join("; ")}.`,
    ].join(" ");
  }).join("\n");
}

export const PRODUCT_DOC: KnowledgeDoc = {
  name: "SixVox — product overview",
  text: `SixVox is a mobile-first business phone app. It gives a person or a small team a real
business number with calling, SMS and MMS, a shared inbox, voicemail with transcription,
and an AI receptionist that answers when nobody can.

Who it is for: solopreneurs, trades and field service businesses, small teams that share one number,
and remote workers who want work calls off their personal line.

Core capabilities
- Business phone numbers: search, buy and manage numbers in-app; each number has its own settings.
- In-app calling: real VoIP calling from the app with a native-feeling dialer, keypad tones and
  haptics, mute, speaker and hold. Calls keep working when the app is backgrounded.
- Bring your own number: keep an existing carrier number and forward calls into SixVox using
  carrier activation codes; SixVox answers, records, transcribes and alerts.
- Messaging: SMS and MMS, a shared inbox with assignment,
  saved templates and scheduled sends.
- AI receptionist: an ElevenLabs voice assistant answers calls, greets in your chosen voice,
  follows your instructions, and captures the reason for the call. It is included on every plan,
  including Solo. Google Calendar booking is in line settings. The default proposes a time and
  waits for the owner to approve it before the customer is texted. Automatic booking is optional.
- Voicemail and transcription: every voicemail transcribed, summarised and searchable.
- Call intelligence: per-call summary, intent, sentiment, urgency, topics, extracted details
  (name, address, date, amount, callback number, email) and one-tap follow-up actions.
- Contacts: stored contacts with notes, plus optional device contact import.
- Tools: Gmail, Google Calendar and Google Maps connections, plus branded email from SixVox.
- Review requests: save a Google review link in Integrations. Mark job done on a thread sends one
  review text when that setting is on. Quiet hours, a per-contact cooldown, and STOP are checked
  first. This is available today.
- Payment links: from a conversation, text a payment link. Stripe Connect is test mode only. The
  charge is created on the connected account, not on SixVox. This is available today. Do not say
  live card payments are on.
- Jobber is available today. Connect under Integrations, then create or match a client and open
  a request from a call thread. Connect stays off until JOBBER_CLIENT_ID and JOBBER_CLIENT_SECRET
  are set. Tokens stay on the server. Do not say a Jobber account is already connected.
- Spanish answering is available today. On the receptionist number sheet or in line settings, the
  owner sets English only, Spanish only, or Auto-detect. Spanish only updates the AI agent prompt
  language. Auto-detect keeps the agent language in English and instructs a switch when the caller
  speaks Spanish. Default missed-call text-back and booking texts can use Spanish when the line is
  Spanish, or when auto and the transcript is Spanish. A custom template stays as saved.
- Number port-in and a native calling app are coming soon. Do not say those are live.
- Alerts: push notifications and email for missed calls, voicemail, inbound messages and AI
  summaries, with quiet hours and a daily digest.
- Travel data eSIM: buy a data eSIM for travel inside the app and install it by QR code.
- Admin and compliance: A2P 10DLC registration, messaging services, verified caller ID,
  roles and permissions, audit log.

Platform: works in any modern browser and as an Android app. A native iPhone app is coming soon.
Dark, slate-and-blue interface designed mobile first.

Where things live in the app: Inbox, Calls, Dialer, Contacts, Insights, Receptionist,
Numbers, Tools, Billing, Settings.`,
};

export const PRICING_DOC: KnowledgeDoc = {
  name: "SixVox — plans and pricing",
  text: `Every plan starts with a ${TRIAL_DAYS}-day free trial (${TRIAL_LIMITS.numbers} number, ${TRIAL_LIMITS.seats} seat, ${TRIAL_LIMITS.aiCalls} AI calls). No contract; monthly or yearly
billing, and yearly is roughly two months cheaper. Cancel any time from Billing.

${planLines()}

Feature comparison:
${FEATURE_MATRIX.map((row) => `- ${row.label}: Solo ${row.solo} / Team ${row.team} / Scale ${row.scale}`).join("\n")}

Notes
- Number and messaging usage is included in the plan allowances shown in-app; extra numbers can be
  added from the Numbers screen.
- Never invent discounts, custom pricing or enterprise terms. If someone needs something outside
  these plans, capture the request and hand off to the team.`,
};

export const FAQ_DOC: KnowledgeDoc = {
  name: "SixVox — frequently asked questions",
  text: `Q: Do I need a new phone?
A: No. SixVox runs on the phone you already have, as an installed app or in the browser.

Q: Can I keep my existing number?
A: Yes. Forward your carrier number into SixVox with the activation codes we show you.
Forwarding takes about a minute and is reversible. Porting the number in is coming soon.

Q: Does the AI receptionist sound robotic?
A: It uses ElevenLabs voices. You pick the voice, the greeting and the instructions, and you can
preview it before it goes live.

Q: What happens when I miss a call?
A: The receptionist or voicemail answers, and you get a push and email alert. Missed-call text-back
is included on every plan and lives in line settings. It texts an unanswered inbound caller only
after the owner turns it on for that line.

Q: Are calls recorded?
A: ${RECORDING_CLAIM} Voicemail a caller leaves is stored so the owner can play it back.

Q: Can a team share one number?
A: Yes, on Team and Scale. The inbox is shared, conversations can be assigned, and internal notes
stay private to the team.

Q: Is there a free trial?
A: Yes, ${TRIAL_DAYS} days on any plan.

Q: Can I text photos?
A: Yes, MMS is supported.

Q: Can I text a Google review request after a job?
A: Yes. Save the Google review link in Integrations, with quiet hours and a cooldown. Mark job done
on a thread sends one review text when that setting is on. The text includes STOP. Quiet hours and
the cooldown can hold it.

Q: Can I text a payment link?
A: Yes, from a conversation. Stripe Connect is test mode. The charge is created on the connected
account, not on SixVox. Do not describe this as live payments.

Q: Can I send a call into Jobber?
A: Yes. Connect Jobber under Integrations, then create or match a client and open a request from
the call thread. Connect stays off until JOBBER_CLIENT_ID and JOBBER_CLIENT_SECRET are set. Tokens
stay on the server. Do not say the account is connected until the owner connects it.

Q: Can the receptionist answer in Spanish?
A: Yes. On the receptionist number sheet or in line settings, choose English only, Spanish only, or
Auto-detect. Spanish only updates the AI agent prompt language. Auto-detect keeps the agent language
in English and tells it to switch when the caller speaks Spanish. The default missed-call text and
booking texts can use Spanish when the line is Spanish, or when auto and the transcript is Spanish.
A custom template stays as saved.

Q: Do you support international calling?
A: Yes for outbound calling and messaging where the destination is permitted; availability and
rates depend on the destination.

Q: How do I cancel?
A: Billing, then cancel. You keep access until the end of the paid period.

Q: Is my data private?
A: Calls, transcripts and messages belong to your workspace. See the privacy policy at /legal/privacy
and terms at /legal/terms.`,
};

export const POSITIONING_DOC: KnowledgeDoc = {
  name: "SixVox — positioning and objections",
  text: `How to talk about SixVox against other business phone apps:
- SixVox is a phone app first, not a telephony dashboard. The dialer, inbox and call history are
  the product; the admin controls are there when you want them.
- The AI receptionist is included on every plan, including Solo. It is configurable per number.
  Approval booking is available in line settings. Automatic booking is an optional setting on that line.
- Spanish answering is available today on the receptionist number sheet and in line settings:
  English only, Spanish only, or Auto-detect. Spanish only updates the AI agent prompt language.
  Auto-detect keeps the agent language in English and switches when the caller speaks Spanish.
  Default missed-call text-back and booking texts can use Spanish when the line is Spanish, or when
  auto and the transcript is Spanish. A custom template stays as saved.
- Call intelligence turns every call into a summary and one-tap follow-ups.
- It works in the browser and as an Android app. A native iPhone app is coming soon.
- Review requests and payment links are in the app. Review texts go out after Mark job done when a
  Google review link is saved in Integrations. Payment links are Stripe Connect test mode, and the
  money stays on the connected account. Port-in is still coming soon. Jobber is in the app:
  connect under Integrations, then create or match a client and request from a call thread.
  Connect stays off until JOBBER_CLIENT_ID and JOBBER_CLIENT_SECRET are set. Tokens stay on the server.

Objection handling
- "Too expensive": compare to a missed job. Point at the ${TRIAL_DAYS}-day trial and monthly billing.
- "I already have a number": forwarding keeps it and adds the AI layer in a minute.
- "I don't trust AI on my calls": the receptionist can be set to greeting-only, or off, per number.
- "Will it work for my team?": Team adds a shared inbox and assignment.
Never disparage competitors by name with claims you cannot verify. Compare on SixVox's own
capabilities. If asked for a direct competitor comparison you are unsure about, say what SixVox does
and offer a callback with the team.`,
};

export const SUPPORT_DOC: KnowledgeDoc = {
  name: "SixVox — getting started and support",
  text: `Getting started: create an account, pick a plan (trial starts immediately), choose a phone
number or forward your existing one, set the receptionist voice and greeting, install the app to
your home screen, and turn on notifications.

Useful pages: / (home), /features, /how-it-works, /pricing, /use-cases, /faq, /contact,
/auth (sign in or create an account), /legal/privacy, /legal/terms.
Inside the app: /inbox, /calls, /contacts, /insights, /receptionist, /numbers, /tools, /billing,
/settings.

Support: the team replies by email. For anything account-specific — billing disputes, porting,
compliance, refunds, outages — hand off to a human instead of guessing.`,
};

export function knowledgeDocs(): KnowledgeDoc[] {
  return [PRODUCT_DOC, PRICING_DOC, FAQ_DOC, POSITIONING_DOC, SUPPORT_DOC];
}
