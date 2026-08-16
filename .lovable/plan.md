# Make "Answer" from an incoming-call alert actually open the call in the app

## What I checked

Inbound call → `src/routes/api/public/twilio/voice.ts` (and `app-voice.ts`) sends a
sticky push with `type: "call"`, `requireInteraction`, and
`url: /calls?incoming=<CallSid>`. The push worker (`public/push-sw.js`) shows it
with **Answer** / **Dismiss** actions. `/calls` reads `?incoming`, primes the
microphone, and shows "Connecting the incoming call to this device…". The
full-screen answer UI (`InCallScreen`) is mounted for the whole authenticated
area, so once Twilio delivers the ring, an Answer button appears.

So the path exists, but three concrete defects break it in practice.

## Defects to fix

1. **Tapping the notification can kill the ringing call.**
   `notificationclick` calls `client.navigate(target)` on the already-open app.
   That is a document navigation: the page reloads, the Twilio Device is
   destroyed and re-registers, and the in-flight incoming call is dropped —
   exactly the case where the user was fastest to answer. Fix: focus the client
   and hand the target to the app via `postMessage`; only use
   `navigate()`/`openWindow()` when no app window is open.

2. **The "Answer" action is treated the same as a plain tap.**
   It should carry intent through to the app so the call is accepted on arrival
   instead of requiring a second tap on the in-call screen. Fix: include
   `action: "answer"` in the message/URL, and have the app auto-accept the
   matching incoming call once the Twilio Device reports it (short bounded wait,
   with the normal Answer button still shown as fallback).

3. **The ringing notification never clears.**
   `InCallScreen` posts `clear-call-notifications` to
   `navigator.serviceWorker.controller`, but the controller is the PWA worker
   (`sw.js`); the notification lives on the separate `push-sw.js` registration,
   which ignores it. Result: a sticky "Incoming call" alert stays after the call
   is answered or ended. Fix: address the push registration directly
   (`getRegistration(PUSH_SW_URL)` → `registration.active.postMessage(...)`), and
   as a backstop close stale `type: "call"` notifications from inside the push
   worker.

## Also covered

- Signed-out / cold start: preserve `?incoming` (and the answer intent) through
  the auth redirect so the deep link still lands on `/calls` after sign-in.
- Keep the existing behaviour when the device is offline (server-side ringback +
  AI hand-off) unchanged.

## Technical notes

Files touched: `public/push-sw.js`, `src/lib/push.ts` (helper to message the push
registration), `src/components/InCallScreen.tsx`, `src/routes/_authenticated/calls.tsx`,
and the auth redirect in `src/routes/_authenticated/route.tsx` / `src/routes/auth.tsx`
for the deep-link preservation. No backend, TwiML, or Twilio wiring changes.

## Verification

Place a live call to a SixVox number with the app backgrounded, tap **Answer** on
the notification, and confirm: the app comes to the foreground without reloading,
the call connects with two-way audio, and the notification disappears.
