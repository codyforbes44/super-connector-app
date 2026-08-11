# Stay signed in everywhere

The session is already stored on the device, but several parts of the app act like it isn't:

- Public pages (home, pricing, how-it-works, nav menu) always show "Sign in" / "Create account", even when the person is already signed in.
- The protected area re-checks the account with the server on every entry. On a flaky connection, in the installed app opened offline, or on a cold start, that check can fail and bounce a signed-in user back to the sign-in screen.
- Signing in from a deep link (for example a link to Calls) always lands on the welcome screen instead of where the person was heading.
- The sign-in screen only checks for an existing session once when it loads, so a session restored a moment later doesn't move the user forward.

The fix is to make signed-in status a single, shared, reactive piece of state that every screen reads — on phone, tablet, and desktop.

## What changes for users

- Open the app on any device that signed in before and you go straight to your inbox — no sign-in screen flash.
- Public pages show "Open app" plus an account menu (with sign out) instead of "Sign in" when you already have a session.
- Losing connectivity, backgrounding the app, or reopening the installed app no longer logs you out. The sign-in screen appears only when there is genuinely no session or it has truly expired.
- Following a link to a specific screen while signed out returns you to that exact screen after signing in, including Google sign-in.
- Signing out clears everything cleanly, and the back button can't restore a signed-in view.

## Technical details

1. `src/hooks/useSession.ts` (new): reads the persisted session with `getSession()`, subscribes once to `onAuthStateChange`, and exposes `{ session, user, status: "loading" | "signedIn" | "signedOut" }`. Surfaces read this instead of ad-hoc `getUser()` calls.
2. `src/routes/_authenticated/route.tsx`: gate on the persisted session first (`getSession()`), redirecting to `/auth` only when no session exists. Treat network/`getUser()` failures that still have a valid stored session as signed in. Keep the subscription/role check, but skip its redirect when those queries fail offline so entitlement checks can't sign anyone out. Redirects to `/auth` carry `redirect=<current path>`.
3. `src/routes/auth.tsx`: accept and validate a same-origin `redirect` search param, and use it for post-sign-in navigation, `emailRedirectTo`, and the Google `redirect_uri` return path. Replace the one-shot `getSession()` effect with the shared session hook so a session restored asynchronously still forwards the user.
4. `src/components/MarketingLayout.tsx` and the CTAs in `index.tsx` / pricing / how-it-works: render session-aware actions — "Open app" plus an account menu with sign out when signed in, current CTAs when signed out. Reserve equal space in both states so mobile headers don't shift.
5. Sign-out hygiene in `settings.tsx` and the new account menu: `cancelQueries()` → `clear()` → `signOut()` → `navigate({ to: "/auth", replace: true })`.
6. PWA: confirm the service worker's navigation fallback keeps `/~oauth` and auth routes on the network so returning from Google sign-in never hits the cached offline shell.

No database or backend changes are needed — auth config already persists sessions with auto-refresh.