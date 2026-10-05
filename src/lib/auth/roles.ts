/**
 * CAMPUS LIFE: staff role rules.
 * Pure logic with no database and no browser data, so it is easy to test.
 * The server uses these rules before every privileged action.
 * Anything unknown or missing is DENIED.
 */

export const STAFF_ROLES = ["OWNER", "SUPER_ADMIN", "ADMIN", "MODERATOR"] as const;
export type StaffRole = (typeof STAFF_ROLES)[number];

const RANK: Record<StaffRole, number> = {
  OWNER: 4,
  SUPER_ADMIN: 3,
  ADMIN: 2,
  MODERATOR: 1,
};

export function isStaffRole(value: unknown): value is StaffRole {
  return typeof value === "string" && (STAFF_ROLES as readonly string[]).includes(value);
}

/** Does this person hold at least the given role? */
export function hasMinRole(actor: unknown, min: StaffRole): boolean {
  if (!isStaffRole(actor)) return false;
  return RANK[actor] >= RANK[min];
}

/** Roles that can ever be handed to another person. OWNER is never on this list. */
export const ASSIGNABLE_ROLES: readonly StaffRole[] = ["SUPER_ADMIN", "ADMIN", "MODERATOR"];

/** Only the OWNER may give out roles, and never the OWNER role itself. */
export function canAssignRole(actor: unknown, newRole: unknown): boolean {
  if (actor !== "OWNER") return false;
  return isStaffRole(newRole) && ASSIGNABLE_ROLES.includes(newRole);
}

/** Only the OWNER may change, suspend or remove staff, and never the OWNER. */
export function canModifyStaffMember(actor: unknown, targetRole: unknown): boolean {
  if (actor !== "OWNER") return false;
  return isStaffRole(targetRole) && targetRole !== "OWNER";
}

export type Permission =
  | "staff.manage"
  | "audit.view"
  | "economy.inject"
  | "players.ban"
  | "players.suspend"
  | "reports.review"
  | "chat.moderate";

/** The lowest role that is allowed to do each thing. */
const PERMISSIONS: Record<Permission, StaffRole> = {
  "staff.manage": "OWNER",
  "audit.view": "SUPER_ADMIN",
  "economy.inject": "SUPER_ADMIN",
  "players.ban": "ADMIN",
  "players.suspend": "MODERATOR",
  "reports.review": "MODERATOR",
  "chat.moderate": "MODERATOR",
};

export function can(actor: unknown, permission: Permission): boolean {
  const minimum = PERMISSIONS[permission];
  if (!minimum) return false;
  return hasMinRole(actor, minimum);
}