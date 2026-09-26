# SixVox native app

Expo app for incoming and outgoing business calls. It uses the same Supabase project as the web app and the official Twilio Voice React Native SDK (`@twilio/voice-react-native-sdk` 1.8.0, Expo SDK 57, React Native 0.86).

Calling needs a development or store build. Expo Go does not include the Twilio native module, so incoming calls, CallKit, and ConnectionService are not available there.

Bundle id and Android package are both `app.sixvox`.

## What the phone does

- Sign in with the same email and password, or Google, as the web app.
- Register with Twilio on login and unregister on logout. A heartbeat every 30 seconds writes a `voice_presence` row for this device without removing the browser row.
- Place calls from an assigned business number, and answer calls through CallKit (iOS) and ConnectionService with a full-screen incoming-call UI (Android). The SDK owns those system UIs. The in-app screen is mute, speaker, keypad, and hangup.
- Read and send SMS, play voicemail, and read call history with the AI summary.
- Everything else (numbers, A2P, billing, receptionist, contacts) opens the web app.

Push credential SIDs are read from environment variables today. The resolver already takes a `workspaceId` so a later per-workspace Twilio subaccount can supply its own SIDs without changing the mobile API.

## Accounts and keys you have to create

Nothing in this repo is a live credential. Create these yourself and do not commit them.

1. Apple Developer account, with an App ID `app.sixvox` that has Push Notifications and Voice over IP.
2. An APNs Auth Key (`.p8`) with the Key ID and Team ID. Use that same key for the Twilio iOS VoIP push credentials and for EAS.
3. A Firebase project with the Android app `app.sixvox`, a downloaded `google-services.json`, and a Firebase service account JSON (Cloud Messaging API, FCM v1).
4. Three Twilio Push Credentials in the same Twilio account that already serves the web app:
   - iOS VoIP, sandbox (development builds)
   - iOS VoIP, production (TestFlight and App Store)
   - Android, FCM v1, using the service account JSON
5. The Supabase URL and publishable key from the existing Lovable Cloud project.
6. An Expo account, for EAS builds. The EAS project id is not a secret.

Server environment (Lovable / hosting, not the phone):

| Variable | Purpose |
| --- | --- |
| `TWILIO_PUSH_CREDENTIAL_SID_IOS_SANDBOX` | `CR…` SID for the sandbox VoIP credential |
| `TWILIO_PUSH_CREDENTIAL_SID_IOS_PRODUCTION` | `CR…` SID for the production VoIP credential |
| `TWILIO_PUSH_CREDENTIAL_SID_ANDROID` | `CR…` SID for the FCM credential |
| `MOBILE_PSTN_FALLBACK` | Leave unset. Set to `true` only after the 20-call test below. When it is on, devices get about 8 seconds to acknowledge an inbound call. If none do, the rest of the ring also dials the owner's cell (`profiles.agent_phone`). |

The phone's `.env` (copy from `.env.example`):

```
EXPO_PUBLIC_SUPABASE_URL=
EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
EXPO_PUBLIC_API_BASE_URL=https://sixvox.3bi.io
```

Development builds use the sandbox APNs credential. Preview and production builds use the production one. Override with `EXPO_PUBLIC_PUSH_ENVIRONMENT=sandbox` or `production` if you need to.

Add the Google redirect `sixvox://auth/callback` (and the Expo dev-client variant if you use one) to the Supabase Auth redirect allow list. Google must already be enabled for the web app.

## Apple

1. In Certificates, Identifiers & Profiles, register the App ID `app.sixvox`. Enable Push Notifications.
2. Create an APNs Auth Key. Download the `.p8` once. Record the Key ID and your Team ID.
3. Twilio Console → Account → Voice → Push Credentials → Create.
   - Type: APN (VoIP).
   - Upload the `.p8`, Key ID, and Team ID.
   - Create one credential with the sandbox checkbox on. Copy its SID into `TWILIO_PUSH_CREDENTIAL_SID_IOS_SANDBOX`.
   - Create a second credential with sandbox off. Copy its SID into `TWILIO_PUSH_CREDENTIAL_SID_IOS_PRODUCTION`.
4. EAS will ask for the same `.p8` the first time you build for iOS. Prefer `eas credentials` so the key stays in Expo's credential store, not in git.

The app config sets `aps-environment` to `development` for the development profile and `production` for preview and production. `UIBackgroundModes` includes `audio`, `voip`, and `remote-notification`. The iOS deployment target is 16.4, which is the minimum Expo SDK 57 accepts. The Twilio config plugin adds the microphone usage string.

## Firebase and Android

1. Create a Firebase project and add an Android app with package `app.sixvox`.
2. Download `google-services.json` into `mobile/`. It is gitignored. A placeholder lives at `google-services.example.json` and is only for compile checks.
3. Firebase → Project settings → Service accounts → Generate a new private key.
4. Twilio Console → Voice → Push Credentials → Create → FCM. Upload that service account JSON (FCM v1, not the legacy server key). Copy the SID into `TWILIO_PUSH_CREDENTIAL_SID_ANDROID`.
5. For EAS, either include `google-services.json` as a local file when you build, or create a file environment variable named `GOOGLE_SERVICES_JSON`. The app config uses that path when it is set.

Android permissions declared for the calling role: `RECORD_AUDIO`, `MODIFY_AUDIO_SETTINGS`, `MANAGE_OWN_CALLS`, `FOREGROUND_SERVICE`, `FOREGROUND_SERVICE_PHONE_CALL`, `USE_FULL_SCREEN_INTENT`, `POST_NOTIFICATIONS`, plus wake, vibrate, and Bluetooth connect. On Android 14 the full-screen incoming call also needs the user to allow full-screen notifications for SixVox, unless the app holds the dialer role.

## Build and ship

From `mobile/`:

```bash
npm install
npx eas login
npx eas init          # writes the project id; put it in extra.eas.projectId if asked
npx eas build --profile development --platform android
npx eas build --profile development --platform ios
```

Install the development build on a device (not Expo Go). Then `npx expo start --dev-client`.

Internal testing:

```bash
npx eas build --profile preview --platform all
npx eas submit --profile production --platform ios      # TestFlight
npx eas submit --profile production --platform android  # Play internal track
```

`eas.json` sends Android production submits to the internal track. iOS submit uses the credentials already stored by EAS. Do not run these until the push credentials and the 20-call test are done.

`MOBILE_PSTN_FALLBACK` stays off until that test passes. Turning it on early will ring the owner's personal cell in parallel with the app.

## Manual test: 20 calls

Use a physical iPhone and a physical Android phone. Development builds for the locked-phone cases. Force-quit means swipe the app away. Locked means the screen is off. Wait for the push credential status in Settings to say a credential is configured before the locked tests.

| # | Setup | Expected |
| --- | --- | --- |
| 1 | iPhone app open, inbound | CallKit rings, Accept connects audio |
| 2 | iPhone app backgrounded, inbound | CallKit rings |
| 3 | iPhone locked, inbound | CallKit rings on the lock screen |
| 4 | iPhone force-quit, inbound | CallKit rings |
| 5 | iPhone, decline from CallKit | Caller continues toward voicemail, no orphaned call in the app |
| 6 | iPhone, outbound from the dialer | Callee sees the business caller ID |
| 7 | iPhone, mute, unmute, speaker, one DTMF digit, hang up | Remote party hears each change |
| 8 | Android app open, inbound | Full-screen incoming call, Accept connects audio |
| 9 | Android app backgrounded, inbound | Full-screen or heads-up incoming call |
| 10 | Android locked, inbound | Full-screen incoming call |
| 11 | Android force-quit, inbound | Incoming call UI, Accept works |
| 12 | Android, reject | Caller continues toward voicemail |
| 13 | Android, outbound, mute, speaker, DTMF, hang up | Same as the iPhone outbound check |
| 14 | Both phones registered, one inbound | Both ring; answering on one stops the other |
| 15 | Web app also signed in, inbound | Browser and phones ring; presence rows stay separate |
| 16 | Sign out on the phone, inbound | That phone does not ring; the other device still can |
| 17 | Send an SMS from the inbox and receive a reply | Thread updates |
| 18 | Leave a voicemail, open Voicemail, play it | Audio plays, transcription is visible |
| 19 | Open Recents after a completed call | AI summary and intent badges show when the web app has written them |
| 20 | Repeat call 4 after a reboot of the iPhone | CallKit still rings |

Only after 1–16 pass, set `MOBILE_PSTN_FALLBACK=true` and place two more inbound calls with the phone in airplane mode after registration (or force-quit and disable notifications) and confirm the owner's cell rings after about 8 seconds, then voicemail still answers if nobody picks up. Turn the flag back off if that cell rings at the same time as a phone that did acknowledge the call.

## Local checks

```bash
npm run typecheck
npm run lint
npm test
```

iOS cannot be compiled on Linux. Android can:

```bash
cp google-services.example.json google-services.json
npx expo prebuild --platform android --no-install
cd android && ./gradlew assembleDebug
```

The example `google-services.json` is a placeholder. A debug APK built with it will not receive FCM.
