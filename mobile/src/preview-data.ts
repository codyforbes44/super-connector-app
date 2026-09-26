import type { Bootstrap, CallRow, Conversation, Message, VoicemailRow } from "./types";

export const previewBootstrap: Bootstrap = {
  ok: true,
  profile: {
    id: "preview",
    display_name: "Cody Forbes",
    email: "cody@example.com",
    agent_phone: "+15555550100",
    default_number: "+15555550123",
    workspace_name: "Forbes Plumbing",
  },
  role: "owner",
  isAdmin: true,
  numbers: [
    {
      sid: "PN00000000000000000000000000000001",
      phone_number: "+15555550123",
      friendly_name: "Main line",
      assigned_to: "preview",
      outbound_caller_id: null,
    },
    {
      sid: "PN00000000000000000000000000000002",
      phone_number: "+15555550124",
      friendly_name: "After hours",
      assigned_to: "preview",
      outbound_caller_id: null,
    },
  ],
};

export const previewConversations: Conversation[] = [
  {
    id: "c1",
    app_number: "+15555550123",
    contact_number: "+15555550999",
    contact_name: "Rivera kitchen",
    channel: "sms",
    last_message_at: new Date().toISOString(),
    last_message_preview: "Can you come look at the leak tomorrow?",
    unread_count: 1,
    opted_out: false,
  },
];

export const previewMessages: Message[] = [
  {
    id: "m1",
    direction: "inbound",
    body: "Can you come look at the leak tomorrow?",
    created_at: new Date().toISOString(),
    status: "received",
    from_number: "+15555550999",
    to_number: "+15555550123",
  },
];

export const previewCalls: CallRow[] = [
  {
    sid: "CA" + "1".repeat(32),
    direction: "inbound",
    from_number: "+15555550999",
    to_number: "+15555550123",
    app_number: "+15555550123",
    status: "completed",
    duration: 186,
    started_at: new Date(Date.now() - 3600_000).toISOString(),
    recording_url: null,
    transcription: null,
    answered_in_app: true,
    intelligence: {
      call_sid: "CA" + "1".repeat(32),
      summary: "Kitchen leak under the sink. Asked for a visit tomorrow morning.",
      intent: "booking",
      sentiment: "neutral",
      urgency: "medium",
      topics: ["leak", "kitchen"],
    },
  },
];

export const previewVoicemails: VoicemailRow[] = [
  {
    sid: "CA" + "2".repeat(32),
    from_number: "+15555550888",
    app_number: "+15555550123",
    started_at: new Date(Date.now() - 7200_000).toISOString(),
    duration: 22,
    transcription: "Hi, this is Dana. The water heater is making a banging noise.",
    recording_url: "https://example.invalid/recording",
  },
];
