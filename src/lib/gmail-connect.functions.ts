import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const GATEWAY_BASE_URL = "https://connector-gateway.lovable.dev";
const CONNECTOR_ID = "google_mail";

/** Scope list shown in the UI before consent. */
export const GMAIL_SCOPE_ROWS = [
  { scope: "userinfo.email", label: "Your Google email address" },
  { scope: "userinfo.profile", label: "Your basic Google profile" },
  { scope: "gmail.readonly", label: "Read your mail (notifications and threads)" },
  { scope: "gmail.send", label: "Send mail on your behalf" },
];

export const startGmailConnect = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const clientKey = process.env["GOOGLE_MAIL_APP_USER_CONNECTOR_CLIENT_API_KEY"];
    if (!clientKey) throw new Error("Gmail connector client is not configured for this project.");

    const { absoluteUrl } = await import("./request-url.server");
    const returnUrl = absoluteUrl("/oauth/google/return");

    const { authorizeAppUserOAuth } = await import("@/integrations/lovable/appUserConnector");
    const { getConnectionKeyForUser } = await import("./app-user-connections.server");
    const { GMAIL_SCOPES } = await import("./gmail-user.server");

    const existing = await getConnectionKeyForUser(context.userId, CONNECTOR_ID);

    const { authorizationUrl } = await authorizeAppUserOAuth({
      gatewayBaseUrl: GATEWAY_BASE_URL,
      connectorId: CONNECTOR_ID,
      appUserId: context.userId,
      clientAPIKey: clientKey,
      returnUrl,
      ...(existing ? { connectionAPIKey: existing } : {}),
      credentialsConfiguration: { scopes: GMAIL_SCOPES },
    });
    return { authorizationUrl };
  });

export const completeGmailConnect = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { code: string }) => input)
  .handler(async ({ data, context }) => {
    const { exchangeAppUserOAuthCode } = await import("@/integrations/lovable/appUserConnector");
    const { saveConnectionKeyForUser } = await import("./app-user-connections.server");
    const gmailUser = await import("./gmail-user.server");

    const { connectionAPIKey, connectorId } = await exchangeAppUserOAuthCode(
      GATEWAY_BASE_URL,
      data.code,
    );
    if (connectorId !== CONNECTOR_ID) throw new Error("OAuth returned the wrong connector.");

    await saveConnectionKeyForUser(context.userId, CONNECTOR_ID, connectionAPIKey, {
      scopes: gmailUser.GMAIL_SCOPES,
    });

    try {
      const me = await gmailUser.profile(context.userId);
      const { setConnectionAccountEmail } = await import("./app-user-connections.server");
      if (me.emailAddress) {
        await setConnectionAccountEmail(context.userId, CONNECTOR_ID, me.emailAddress);
      }
    } catch (error) {
      console.error("gmail profile after connect failed", error);
    }
    return { ok: true };
  });

export const getGmailConnection = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { getConnectionMeta } = await import("./app-user-connections.server");
    const meta = await getConnectionMeta(context.userId, CONNECTOR_ID);
    return {
      connected: Boolean(meta),
      accountEmail: (meta?.account_email as string | null) ?? null,
      connectedAt: (meta?.updated_at as string | null) ?? null,
      scopes: GMAIL_SCOPE_ROWS,
    };
  });

export const disconnectGmail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { getConnectionKeyForUser, deleteConnectionForUser } = await import(
      "./app-user-connections.server"
    );
    const key = await getConnectionKeyForUser(context.userId, CONNECTOR_ID);
    if (key) {
      const { disconnectAppUser } = await import("@/integrations/lovable/appUserConnector");
      try {
        await disconnectAppUser({
          gatewayBaseUrl: GATEWAY_BASE_URL,
          connectionAPIKey: key,
          connectorId: CONNECTOR_ID,
        });
      } catch (error) {
        console.error("gateway disconnect failed", error);
      }
    }
    await deleteConnectionForUser(context.userId, CONNECTOR_ID);
    return { ok: true };
  });