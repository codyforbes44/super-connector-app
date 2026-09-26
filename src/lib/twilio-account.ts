/**
 * Which Twilio account a workspace's API calls authenticate as.
 * Parent-account credentials stay on the original workspace until an owner
 * runs the explicit number migration. Every other workspace uses its subaccount.
 */

export type TwilioAccountCredentials = {
  accountSid: string;
  authToken: string;
  apiKeySid: string | null;
  apiKeySecret: string | null;
  twimlAppSid: string | null;
  messagingServiceSid: string | null;
  source: "parent" | "subaccount";
};

export function selectTwilioAccount(input: {
  usesParentAccount: boolean;
  subaccountSid: string | null;
  subaccountAuthToken: string | null;
  apiKeySid: string | null;
  apiKeySecret: string | null;
  twimlAppSid: string | null;
  messagingServiceSid: string | null;
  parent: {
    accountSid: string;
    authToken: string;
    apiKeySid: string | null;
    apiKeySecret: string | null;
  };
}): TwilioAccountCredentials {
  const subaccountReady = Boolean(input.subaccountSid && input.subaccountAuthToken);
  if (!input.usesParentAccount && subaccountReady) {
    return {
      accountSid: input.subaccountSid as string,
      authToken: input.subaccountAuthToken as string,
      apiKeySid: input.apiKeySid,
      apiKeySecret: input.apiKeySecret,
      twimlAppSid: input.twimlAppSid,
      messagingServiceSid: input.messagingServiceSid,
      source: "subaccount",
    };
  }
  return {
    accountSid: input.parent.accountSid,
    authToken: input.parent.authToken,
    apiKeySid: input.parent.apiKeySid,
    apiKeySecret: input.parent.apiKeySecret,
    twimlAppSid: input.twimlAppSid,
    messagingServiceSid: input.messagingServiceSid,
    source: "parent",
  };
}
