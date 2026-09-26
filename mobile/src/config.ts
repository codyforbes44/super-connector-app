import Constants from "expo-constants";

type Extra = {
  apiBaseUrl?: string;
  supabaseUrl?: string;
  supabasePublishableKey?: string;
};

function extra(): Extra {
  const fromExpo = Constants.expoConfig?.extra;
  if (fromExpo && typeof fromExpo === "object") return fromExpo as Extra;
  return {};
}

export function apiBaseUrl(): string {
  return (process.env.EXPO_PUBLIC_API_BASE_URL || extra().apiBaseUrl || "https://sixvox.3bi.io").replace(
    /\/$/,
    "",
  );
}

export function supabaseConfig(): { url: string; publishableKey: string } | null {
  const url = process.env.EXPO_PUBLIC_SUPABASE_URL || extra().supabaseUrl || "";
  const publishableKey =
    process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY || extra().supabasePublishableKey || "";
  if (!url || !publishableKey) return null;
  return { url, publishableKey };
}

export function previewMode(): boolean {
  return process.env.EXPO_PUBLIC_UI_PREVIEW === "1";
}

export function pushEnvironment(): "sandbox" | "production" {
  const override = process.env.EXPO_PUBLIC_PUSH_ENVIRONMENT;
  if (override === "sandbox" || override === "production") return override;
  return __DEV__ ? "sandbox" : "production";
}
