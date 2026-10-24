# Super admin: assign and manage phone numbers per user

Make what was done by hand for Jagar a few taps in Platform admin.

## What you'll get
**Numbers tab** gets a "Manage" button on each number:
- **Move to team**: pick any team. The number and its calls and texts history stay with it.
- **Assign people**: choose which team members can see and use the number (like Jagar on +1 817-508-9595). Add or remove.
- **Unassign**: take the number away from a team without deleting it from Twilio.
- Shows texting approval status, with a link to Texting approval.

**Accounts tab** gets a "Set up user" action for one person:
- Create their own team (or add them to an existing one) and choose their role (owner, admin, agent).
- Give them a number from the unassigned list.
- Optional: give free (comped) plan access to the team.

**Safety**
- The AI concierge line (+1 817-533-8844) stays locked and can't be moved.
- Twilio call and text settings are never changed. This only controls who sees the number inside SixVox.
- Every change is recorded in the Audit tab, and you confirm before a number moves.

## Technical details
- New super-admin-only server functions in `src/lib/platform.functions.ts`: `platformAssignNumber` (sets phone_numbers.workspace_id, re-scopes sibling rows when needed), `platformSetNumberAssignees` (number_assignees), `platformSetupUser` (workspaces + workspace_members + user_roles + optional workspace_entitlements comp). Each one checks `is_super_admin`, uses the admin client inside the handler, writes to `audit_log`, and refuses the protected number.
- UI: a sheet in `platform/numbers.tsx`, and a dialog in `platform/accounts.tsx` built from the shared screen parts.
- Tests: protected number rejected, non-super-admin rejected.
