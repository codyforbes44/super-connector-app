const { withAndroidManifest } = require("@expo/config-plugins");

/**
 * Permissions the Twilio Voice Android SDK needs for ConnectionService,
 * a phone-call foreground service, and a full-screen incoming-call UI.
 * The SDK's own manifest merges the service classes. This plugin only adds
 * the permissions Play requires us to declare on the app.
 */
const PERMISSIONS = [
  "android.permission.RECORD_AUDIO",
  "android.permission.MODIFY_AUDIO_SETTINGS",
  "android.permission.MANAGE_OWN_CALLS",
  "android.permission.FOREGROUND_SERVICE",
  "android.permission.FOREGROUND_SERVICE_PHONE_CALL",
  "android.permission.USE_FULL_SCREEN_INTENT",
  "android.permission.POST_NOTIFICATIONS",
  "android.permission.WAKE_LOCK",
  "android.permission.VIBRATE",
  "android.permission.DISABLE_KEYGUARD",
  "android.permission.BLUETOOTH_CONNECT",
];

/** @type {import("@expo/config-plugins").ConfigPlugin} */
const withAndroidCalling = (config) =>
  withAndroidManifest(config, (mod) => {
    const manifest = mod.modResults.manifest;
    const existing = manifest["uses-permission"] ?? [];
    const names = new Set(
      existing.map((entry) => entry.$["android:name"]).filter((name) => Boolean(name)),
    );
    for (const name of PERMISSIONS) {
      if (!names.has(name)) {
        existing.push({ $: { "android:name": name } });
      }
    }
    manifest["uses-permission"] = existing;
    return mod;
  });

module.exports = withAndroidCalling;
