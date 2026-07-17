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

/** URL-safe slug from a name (accent-stripped, lowercased, hyphenated). */
export function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

export interface CategoryInput {
  name: string;
  slug: string;
}

export interface CategoryErrors {
  name?: string;
  slug?: string;
}

export function validateCategory(form: FormData): { data: CategoryInput; errors: CategoryErrors } {
  const name = String(form.get("name") ?? "").trim();
  let slug = String(form.get("slug") ?? "").trim();
  if (!slug && name) slug = slugify(name);
  else slug = slugify(slug);

  const errors: CategoryErrors = {};
  if (!name) errors.name = "El nombre es obligatorio.";
  if (!slug) errors.slug = "El slug es obligatorio.";
  return { data: { name, slug }, errors };
}
