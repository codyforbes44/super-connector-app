export type IntegrationsSnapshot = {
  registeredTextingNumber: string;
  jobber: {
    configured: boolean;
    connected: boolean;
    accountName: string | null;
  };
  housecall: {
    connected: boolean;
    keyHint: string | null;
    maxPlanCopy: string;
  };
  reviews: {
    reviewUrl: string;
    businessName: string;
    enabled: boolean;
    cooldownDays: number;
    quietStart: string;
    quietEnd: string;
    timezone: string;
  };
  connect: {
    configured: boolean;
    accountId: string | null;
    cardPayments: string;
    chargesActive: boolean;
    label: string | null;
  };
  port: {
    id: string | null;
    status: string | null;
    phoneNumber: string | null;
    accountLast4: string | null;
    rejectionReason: string | null;
    forwardingDefault: boolean;
    liveEnabled: boolean;
  };
};

export type ReviewSettingsInput = IntegrationsSnapshot["reviews"];
