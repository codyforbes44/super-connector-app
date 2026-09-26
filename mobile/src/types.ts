export type BusinessNumber = {
  sid: string;
  phone_number: string;
  friendly_name: string | null;
  assigned_to: string | null;
  outbound_caller_id: string | null;
};

export type Profile = {
  id: string;
  display_name: string | null;
  email: string | null;
  agent_phone: string | null;
  default_number: string | null;
  workspace_name: string | null;
};

export type Bootstrap = {
  ok: true;
  profile: Profile | null;
  role: string;
  isAdmin: boolean;
  numbers: BusinessNumber[];
};

export type Conversation = {
  id: string;
  app_number: string;
  contact_number: string;
  contact_name: string | null;
  channel: string;
  last_message_at: string;
  last_message_preview: string | null;
  unread_count: number;
  opted_out: boolean;
};

export type Message = {
  id: string;
  direction: string;
  body: string | null;
  created_at: string;
  status: string | null;
  from_number: string;
  to_number: string;
};

export type CallIntelligence = {
  call_sid: string;
  summary: string | null;
  intent: string | null;
  sentiment: string | null;
  urgency: string | null;
  topics: string[] | null;
};

export type CallRow = {
  sid: string;
  direction: string;
  from_number: string;
  to_number: string;
  app_number: string;
  status: string | null;
  duration: number | null;
  started_at: string;
  recording_url: string | null;
  transcription: string | null;
  answered_in_app: boolean;
  intelligence: CallIntelligence | null;
};

export type VoicemailRow = {
  sid: string;
  from_number: string;
  app_number: string;
  started_at: string;
  duration: number | null;
  transcription: string | null;
  recording_url: string | null;
};
