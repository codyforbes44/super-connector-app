# Add Dezi to the SixVox org

Dezi (dezifab26@gmail.com) already has an account with admin access, but she's still sitting behind the trial/onboarding flow and has no phone line. This grants her a line, comps her plan, skips setup, and greets her once.

## What changes

**Account setup (data changes)**

- Assign (580) 745-0045 to Dezi and make it her default number.
- Keep her admin role (full app access).
- Mark her plan as comped and active under your org so she never sees billing or trial prompts.
- Mark her onboarding as complete so she goes straight into the app instead of the setup wizard.
- Flag her profile so the app knows to show a first-run welcome.
- Set the workspace name to "SixVox" on both profiles.

Note: (580) 745-0045 is the A2P-approved SMS number and is currently yours. Reassigning it moves that line to Dezi — you keep (580) 217-8444 and (817) 533-8844. Admin still sees all numbers.

**First-run welcome**

- A one-time welcome card appears the first time she opens the app: "Welcome to SixVox, Dezi", a short line about her number being live, and quick links to the dialer, inbox and settings.
- Dismissing it clears the flag so it never shows again. It only appears for users carrying the welcome flag, so nothing changes for you.

## Technical details

- One data update against `profiles`, `phone_numbers`, `subscriptions`: set `phone_numbers.assigned_to` for `+15807450045`, `profiles.default_number`, `onboarding_completed = true`, `workspace_name = 'SixVox'`, `onboarding_state` gets `{"welcome_pending": true}`, and `subscriptions` set to `comped = true, status = 'active', plan_code = 'scale'` for her user id.
- New `src/components/WelcomeDialog.tsx`, mounted in `src/routes/_authenticated/route.tsx`'s layout. It reads `onboarding_state.welcome_pending` from the current profile and, on dismiss, writes `welcome_pending: false` back via the existing profile update path.
- No change to the `/welcome` onboarding route or the gate logic in `route.tsx` — she simply passes it now that `onboarding_completed` is true.
