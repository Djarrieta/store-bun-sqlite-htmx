/** Categories permissions + validation (tech-spec §6). */
import { registerPermissions, type PermissionMatrix } from "../../core/permissions.ts";

export const CATEGORIES_KEY = "categories";

export const categoriesPermissions: PermissionMatrix = {
  view: ["admin", "manager", "sales", "logistic"],
  create: ["admin", "manager"],
  edit: ["admin", "manager"],
  delete: ["admin", "manager"],
};

registerPermissions(CATEGORIES_KEY, categoriesPermissions);

export interface CategoryInput {
  name: string;
}

export interface CategoryErrors {
  name?: string;
}

export function validateCategory(form: FormData): { data: CategoryInput; errors: CategoryErrors } {
  const name = String(form.get("name") ?? "").trim();

  const errors: CategoryErrors = {};
  if (!name) errors.name = "El nombre es obligatorio.";
  return { data: { name }, errors };
}
