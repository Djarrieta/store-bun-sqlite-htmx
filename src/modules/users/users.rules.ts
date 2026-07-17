/** Users admin permissions (tech-spec §12; admin-only). */
import { registerPermissions, type PermissionMatrix } from "../../core/permissions.ts";

export const USERS_KEY = "users";

export const usersPermissions: PermissionMatrix = {
  view: ["admin"],
  edit_role: ["admin"],
};

registerPermissions(USERS_KEY, usersPermissions);
