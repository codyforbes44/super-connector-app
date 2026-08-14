/** Tool contracts shared by the ElevenLabs agent config and the server handlers. */

export type ToolName =
  | "get_pricing"
  | "capture_lead"
  | "send_followup_email"
  | "book_callback"
  | "handoff_to_human"
  | "get_my_account"
  | "get_my_recent_activity";

export type ClientToolName = "navigate" | "start_signup" | "open_app_screen";

type Prop = { type: "string" | "number" | "boolean"; description: string; required?: boolean };

export type ServerToolDef = {
  name: ToolName;
  description: string;
  properties: Record<string, Prop>;
};

export const SERVER_TOOLS: ServerToolDef[] = [
  {
    name: "get_pricing",
    description:
      "Live SixVox plans: names, monthly and yearly prices, included numbers and seats, trial length. Call this before quoting any price.",
    properties: {
      plan: {
        type: "string",
        description:
          "Optional plan code to focus on: solo, team or scale. Leave empty for all plans.",
      },
    },
  },
  {
    name: "capture_lead",
    description:
      "Save an interested visitor so the SixVox team can follow up. Requires a name and at least an email or a phone number.",
    properties: {
      name: { type: "string", description: "Visitor's name.", required: true },
      email: { type: "string", description: "Email address, if given." },
      phone: { type: "string", description: "Phone number in any format, if given." },
      company: { type: "string", description: "Business name, if mentioned." },
      need: {
        type: "string",
        description: "One or two sentences on what they are trying to solve.",
        required: true,
      },
      urgency: { type: "string", description: "low, normal or high." },
      plan_interest: { type: "string", description: "solo, team or scale if they indicated one." },
    },
  },
  {
    name: "send_followup_email",
    description:
      "Email the visitor a short recap and the next step. Only use an email address they gave you in this conversation.",
    properties: {
      email: { type: "string", description: "Recipient email address.", required: true },
      name: { type: "string", description: "Recipient name." },
      recap: {
        type: "string",
        description: "Two or three sentences recapping what was discussed and what happens next.",
        required: true,
      },
      next_step: {
        type: "string",
        description:
          "The single action you want them to take, for example 'start your free trial'.",
      },
    },
  },
  {
    name: "book_callback",
    description: "Request a callback from the SixVox team at a time window the visitor gives you.",
    properties: {
      name: { type: "string", description: "Visitor's name.", required: true },
      phone: { type: "string", description: "Phone number to call.", required: true },
      email: { type: "string", description: "Email address, if given." },
      window: {
        type: "string",
        description: "Their words for when to call, for example 'tomorrow before noon'.",
        required: true,
      },
      timezone: { type: "string", description: "Their timezone if known." },
      topic: { type: "string", description: "What they want to talk about." },
    },
  },
  {
    name: "handoff_to_human",
    description:
      "Flag this conversation for a human on the SixVox team. Use for account, billing, porting or compliance issues, or when the visitor asks for a person.",
    properties: {
      reason: { type: "string", description: "Why a human is needed.", required: true },
      contact: { type: "string", description: "Best email or phone to reach them, if known." },
      urgency: { type: "string", description: "low, normal or high." },
    },
  },
  {
    name: "get_my_account",
    description:
      "Signed-in users only: their plan, trial status, phone numbers and receptionist setup.",
    properties: {},
  },
  {
    name: "get_my_recent_activity",
    description:
      "Signed-in users only: a short summary of recent calls, voicemails and unread messages.",
    properties: {},
  },
];

export const CLIENT_TOOLS: Array<{
  name: ClientToolName;
  description: string;
  properties: Record<string, Prop>;
}> = [
  {
    name: "navigate",
    description:
      "Open a page on the SixVox website in the visitor's browser. Use site paths such as /pricing, /features, /how-it-works, /use-cases, /faq or /contact.",
    properties: {
      path: { type: "string", description: "Site path beginning with /.", required: true },
      reason: { type: "string", description: "Short reason, shown to the visitor." },
    },
  },
  {
    name: "start_signup",
    description: "Send the visitor to create a SixVox account and start their free trial.",
    properties: {
      plan: { type: "string", description: "Optional plan code: solo, team or scale." },
    },
  },
  {
    name: "open_app_screen",
    description:
      "Signed-in users only: open a screen inside the app, such as /inbox, /calls, /receptionist, /numbers, /tools, /billing or /settings.",
    properties: {
      path: { type: "string", description: "App path beginning with /.", required: true },
    },
  },
];

export function jsonSchemaFor(properties: Record<string, Prop>) {
  const props: Record<string, { type: string; description: string }> = {};
  const required: string[] = [];
  for (const [key, value] of Object.entries(properties)) {
    props[key] = { type: value.type, description: value.description };
    if (value.required) required.push(key);
  }
  return { type: "object", properties: props, required };
}
