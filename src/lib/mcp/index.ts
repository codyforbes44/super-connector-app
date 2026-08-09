import { auth, defineMcp } from "@lovable.dev/mcp-js";

import getConversationTool from "./tools/get-conversation";
import listCallsTool from "./tools/list-calls";
import listContactsTool from "./tools/list-contacts";
import listConversationsTool from "./tools/list-conversations";
import listPhoneNumbersTool from "./tools/list-phone-numbers";
import sendMessageTool from "./tools/send-message";

const projectRef = import.meta.env["VITE_SUPABASE_PROJECT_ID"] ?? "project-ref-unset";

// exactOptionalPropertyTypes: defineTool leaves `outputSchema` as undefined.
const tools = [
  listPhoneNumbersTool,
  listConversationsTool,
  getConversationTool,
  sendMessageTool,
  listCallsTool,
  listContactsTool,
] as unknown as Parameters<typeof defineMcp>[0]["tools"];

export default defineMcp({
  name: "twilio-connect-pro",
  title: "Twilio Connect Pro",
  version: "0.1.0",
  instructions:
    "Tools for the SixVox business phone app. Read the signed-in user's lines, conversations, calls, voicemail transcripts and contacts, and send SMS or WhatsApp messages from their own numbers. Call list_phone_numbers first to learn which lines are available.",
  auth: auth.oauth.issuer({
    issuer: `https://${projectRef}.supabase.co/auth/v1`,
    acceptedAudiences: "authenticated",
  }),
  tools,
});