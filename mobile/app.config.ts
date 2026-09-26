import fs from "fs";
import path from "path";

import type { ConfigContext, ExpoConfig } from "expo/config";

import withAndroidCalling from "./plugins/withAndroidCalling.js";

function googleServicesFile(): string | undefined {
  const fromEnv = process.env.GOOGLE_SERVICES_JSON;
  if (fromEnv && fs.existsSync(fromEnv)) return fromEnv;
  const local = path.join(process.cwd(), "google-services.json");
  if (fs.existsSync(local)) return "./google-services.json";
  return undefined;
}

const profile = process.env.EAS_BUILD_PROFILE ?? "development";
const pushOverride = process.env.EXPO_PUBLIC_PUSH_ENVIRONMENT;
const apsEnvironment =
  pushOverride === "production" || profile === "preview" || profile === "production"
    ? "production"
    : "development";

export default ({ config }: ConfigContext): ExpoConfig => {
  const servicesFile = googleServicesFile();
  return {
  ...config,
  name: "SixVox",
  slug: "sixvox",
  scheme: "sixvox",
  version: "1.0.0",
  orientation: "portrait",
  userInterfaceStyle: "automatic",
  icon: "./assets/icon.png",
  ios: {
    bundleIdentifier: "app.sixvox",
    supportsTablet: false,
    icon: "./assets/icon.png",
    infoPlist: {
      NSMicrophoneUsageDescription: "SixVox uses the microphone for business calls.",
      UIBackgroundModes: ["audio", "voip", "remote-notification"],
    },
    entitlements: {
      "aps-environment": apsEnvironment,
    },
  },
  android: {
    package: "app.sixvox",
    ...(servicesFile ? { googleServicesFile: servicesFile } : {}),
    adaptiveIcon: {
      foregroundImage: "./assets/adaptive-icon.png",
      backgroundColor: "#12151c",
    },
    permissions: [
      "android.permission.RECORD_AUDIO",
      "android.permission.MODIFY_AUDIO_SETTINGS",
      "android.permission.MANAGE_OWN_CALLS",
      "android.permission.FOREGROUND_SERVICE",
      "android.permission.FOREGROUND_SERVICE_PHONE_CALL",
      "android.permission.USE_FULL_SCREEN_INTENT",
      "android.permission.POST_NOTIFICATIONS",
      "android.permission.WAKE_LOCK",
      "android.permission.VIBRATE",
      "android.permission.BLUETOOTH_CONNECT",
    ],
  },
  plugins: ([
    "expo-router",
    "expo-secure-store",
    "expo-audio",
    [
      "@twilio/voice-react-native-sdk",
      {
        apsEnvironment,
        microphoneUsageDescription: "SixVox uses the microphone for business calls.",
      },
    ],
    withAndroidCalling,
    [
      "expo-build-properties",
      {
        android: {
          minSdkVersion: 24,
          compileSdkVersion: 36,
          targetSdkVersion: 36,
        },
        ios: {
          deploymentTarget: "16.4",
        },
      },
    ],
  ] as unknown as NonNullable<ExpoConfig["plugins"]>),
  experiments: {
    typedRoutes: false,
  },
  extra: {
    apiBaseUrl: process.env.EXPO_PUBLIC_API_BASE_URL ?? "https://sixvox.3bi.io",
    supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL ?? "",
    supabasePublishableKey: process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "",
    eas: {
      projectId: process.env.EAS_PROJECT_ID ?? "",
    },
  },
  };
};
