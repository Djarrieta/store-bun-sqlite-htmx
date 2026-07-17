/**
 * Authorization: `can()` + `registerPermissions`. Deny-by-default.
 * The per-module matrix (in `<n>.rules.ts`) is the single source of truth;
 * capabilities are gated in the VIEW and in the ROUTE (tech-spec §6, §13.4).
 */

export type Role = "admin" | "manager" | "sales" | "logistic" | "financial" | "customer";

export const ALL_ROLES: Role[] = ["admin", "manager", "sales", "logistic", "financial", "customer"];

/** Roles that can access `/admin` at all. */
export const STAFF_ROLES: Role[] = ["admin", "manager", "sales", "logistic", "financial"];

/** Minimal principal shape used by `can()`. */
export interface Principal {
  role: Role;
}

/** action -> set of roles allowed. */
export type PermissionMatrix = Record<string, Role[]>;

const registry = new Map<string, PermissionMatrix>();

export function registerPermissions(moduleKey: string, matrix: PermissionMatrix): void {
  registry.set(moduleKey, matrix);
}

export function getPermissions(moduleKey: string): PermissionMatrix | undefined {
  return registry.get(moduleKey);
}

/**
 * Returns true if `user` may perform `action` on `moduleKey`.
 * Deny-by-default: unknown module, unknown action, or null user => false.
 */
export function can(user: Principal | null, moduleKey: string, action: string): boolean {
  if (!user) return false;
  const matrix = registry.get(moduleKey);
  if (!matrix) return false;
  const allowed = matrix[action];
  if (!allowed) return false;
  return allowed.includes(user.role);
}

/** True if the user can reach the admin panel (has any staff role). */
export function isStaff(user: Principal | null): boolean {
  return Boolean(user && STAFF_ROLES.includes(user.role));
}
