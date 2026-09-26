# Outbound call check, one-tap call back, and reliable ringing

Three things: prove outbound audio works end to end, add a call-back button to
call history, and make sure the app asks for (and actually uses) notification
permission so incoming calls ring.

## 1. Verify outbound calls and audio

A verification pass rather than a rewrite — the dialer already routes three ways
(in-app, ring-your-phone bridge, direct). Checks:

- Confirm the browser device registers and mints a voice token, that the
  microphone prompt fires before the first call, and that the call reaches
  `<Dial>` with `answerOnBridge` so you don't hear dead air before pickup.
- Confirm the caller ID the recipient sees matches the resolved outbound ID.
- Add a small **Call status** line to the dialer showing whether in-app calling
  is connected, connecting, or unavailable (with the reason), so a silent
  failure is visible instead of guessed at.
- If the device can't register, the dialer falls back automatically today; that
  fallback stays and is stated in the helper text.

Anything the check turns up as actually broken gets fixed in the same pass and
reported back.

## 2. Call back from the Calls screen

- Each history row gets a green call button next to the existing play button.
  One tap redials that person using the number the call came in on (or the
  number you dialed out from), through whichever path is available.
- The call-details sheet gets a full-width **Call back** button too.
- Rows with no usable number (blocked/unknown) show the button disabled.

## 3. Notifications and ringing

- Add a **Notifications** status row on the Calls screen (the Settings panel
  stays) showing whether alerts are on, with a one-tap enable when they're not —
  permission must be requested from a user gesture.
- When a ring push arrives while the app is closed, tapping it opens
  `/calls?incoming=<sid>`; the Calls screen will read that parameter and surface
  the incoming-call screen instead of ignoring it.
- Play an audible in-app ringtone (looping, generated in the browser) when a
  call comes in while the app is open, so the phone rings rather than silently
  showing a screen. Stops on answer or decline.
- iOS note surfaced in the UI: notifications only work when SixVox is installed
  to the Home Screen. The status row says so when it detects iOS Safari.

## Technical notes

- `src/routes/_authenticated/calls.tsx`: redial handler reusing the existing
  `voice.call` / `startCall` branch, per-row and detail-sheet buttons, incoming
  search param wired into the voice context, device + notification status rows.
- `src/components/InCallScreen.tsx`: ringtone start/stop tied to
  `callState === "ringing" && direction === "inbound"`.
- New `src/lib/ringtone.ts`: WebAudio loop, no asset download.
- `src/lib/voice-device.tsx`: expose the pending incoming call SID so a
  deep-linked ring can be matched; no change to token or presence logic.
- Notification helpers already exist in `src/lib/push.ts`; the new status row
  reuses `pushPermission()` and `enablePush()`.
