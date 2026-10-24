# Make codyforbes@gmail.com both Super Admin and Owner

## What changes
- Keep the existing **owner** role for codyforbes@gmail.com.
- Add a **super_admin** role alongside it, so the account has both.
- No code, pricing, numbers, or other users change. Nothing is published.

## What you'll see
- The platform-level panels (Subscribers, Webhook Errors) unlock in your More menu right after you refresh.
- Your workspace ownership and comped Scale plan stay exactly the same.

## Technical details
- One data insert into `public.user_roles`: `(user_id = d14f58ab-0e3f-476e-a0ad-65d281305107, role = 'super_admin')`, using `ON CONFLICT (user_id, role) DO NOTHING` so it is safe to repeat. The existing `owner` row is left untouched.
- The `workspace_members` owner row is not modified.
- Verify afterwards with a read query that the user has exactly the `owner` and `super_admin` rows, and that `is_super_admin(...)` logic resolves via the role table (app-level `getRole` already prefers `super_admin`).
