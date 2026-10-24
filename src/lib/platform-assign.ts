import { isElPrimaryNumber } from "@/lib/wiring";

export const MEMBER_ROLES = ["owner", "admin", "agent"] as const;
export type MemberRole = (typeof MEMBER_ROLES)[number];

/** Throws when a platform admin tries to reassign a number that must never move. */
export function assertAssignable(phoneNumber: string) {
  if (isElPrimaryNumber(phoneNumber)) throw new Error("This line is locked to the AI concierge and can't be reassigned.");
}

export function parseRole(role: string): MemberRole {
  if ((MEMBER_ROLES as readonly string[]).includes(role)) return role as MemberRole;
  throw new Error("Role must be owner, admin or agent.");
}
