/**
 * Who may place an in-app outbound call from a given SixVox number.
 *
 * This runs inside the Twilio voice webhook as the service role. Do not call
 * public.is_admin() here: that function also requires auth.uid() to equal the
 * user id, which is never true for the service role, so owners and admins
 * would be treated as ordinary agents.
 */

const ACCOUNT_ADMIN_ROLES = new Set(["super_admin", "owner", "admin"]);

export function canPlaceOutboundAppCall(input: {
  numberOnAccount: boolean;
  assignedTo: string | null;
  userId: string;
  roles: readonly string[];
}): boolean {
  if (!input.numberOnAccount || !input.userId) return false;
  if (input.roles.some((role) => ACCOUNT_ADMIN_ROLES.has(role))) return true;
  return input.assignedTo === input.userId;
}
