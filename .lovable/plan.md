# Remove the "Call me on" step from the dialer

The dialer no longer asks where to reach you. It uses the phone number already saved in your Settings automatically.

## What changes

- The "Call me on" input disappears from the dial screen entirely.
- When in-app calling is connected, calls go through the app as they do today.
- When in-app calling isn't connected, we ring the number saved in Settings, then bridge the contact — silently, with no extra field to fill.
- If no number is saved at all, the Call button stays enabled and the only feedback is a short message pointing to Settings.
- The helper line under the dialer simply says which phone we'll ring first (or "your phone" when unknown).

## Technical notes

- `src/routes/_authenticated/calls.tsx`: drop the `callbackNumber` state, its `Input`/`Label` block, its share of the submit-disabled condition, and stop passing `callbackNumber` to `startCall`.
- `src/lib/twilio-ops.server.ts` (`startCall`): keep the optional `callbackNumber` argument for compatibility but rely on `profiles.agent_phone`; remove the write-back of the entered number.
- `src/lib/twilio.functions.ts`: input shape unchanged, so no validator edits needed.
