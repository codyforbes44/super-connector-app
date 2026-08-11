# Make the in-call speaker button actually work

## What I found

The speaker button on the in-call screen is not wired up. In `src/components/InCallScreen.tsx` it renders with an empty click handler and is permanently disabled, so tapping it does nothing — audio always stays on whatever route the browser picked. The call layer already knows how to bind an output device (the keepalive helper sets Twilio's speaker and ringtone devices), but nothing lets the user choose one.

## What to build

**A real speaker toggle**

- The button becomes live and reflects true state: off = normal route (earpiece/handset or headset), on = loudspeaker.
- Tapping switches the live call's output immediately, with haptic feedback and the same active styling the mute button uses.
- The choice persists for the rest of the call and is reset when the call ends, so the next call starts on the default route.
- If a headset or Bluetooth device is connected mid-call, the existing auto-rebind no longer overrides a manual speaker choice.

**More than two outputs**

When the device exposes several outputs (Bluetooth earbuds, wired headset, laptop speakers), a long-press on the speaker button opens a compact sheet listing them by name so the user can pick directly, rather than being limited to a two-way toggle.

**Honest behaviour where the platform blocks it**

Browsers on iPhone and iPad do not let a web app choose between earpiece and loudspeaker — that switch belongs to iOS. On those devices the button stays visible but shows a short explanation on tap ("iOS controls this — use the phone's own speaker control or connect a headset") instead of silently doing nothing. Everywhere else (Android, desktop browsers, installed Android app) it works normally.

## Verification

- Place an outbound call and confirm audio is audible on the default route, then toggle speaker and confirm the audio moves and the button shows as active.
- Toggle back and confirm audio returns to the earpiece route.
- Connect a Bluetooth headset mid-call and confirm the manual choice is respected, and the device sheet lists it.
- Confirm the reported state matches the actual output after backgrounding and returning to the app.
- Confirm an iPhone shows the explanatory message rather than a dead button.

## Technical notes

- Output routing goes through the Twilio Device audio helper (`speakerDevices` / `ringtoneDevices`) already typed in `src/lib/call-keepalive.ts`; the underlying browser capability is `setSinkId`, which is feature-detected rather than assumed.
- Speaker state, the available output list, and the setter are exposed from the voice context in `src/lib/voice-device.tsx` so the in-call screen stays presentational.
- `rebindAudioDevices` gains an "explicit output" argument so an automatic re-bind after backgrounding restores the user's chosen output instead of the OS-preferred one; the reset already performed at call end clears it.
- No backend, Twilio configuration, or billing changes.
