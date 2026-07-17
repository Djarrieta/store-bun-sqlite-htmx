/** Categories admin routes. Permissions gated in view AND route. */
import type { Router } from "../../core/router.ts";
import { html, fragment, redirect, notFound } from "../../core/http.ts";
import { requirePermission } from "../../auth/index.ts";
import { categoriesRepo } from "./categories.db.ts";
import { CATEGORIES_KEY, validateCategory } from "./categories.rules.ts";
import { categoriesListPage, categoriesListFragment, categoryFormPage } from "./categories.views.ts";

const BASE = "/admin/categorias";

export function registerCategoriesRoutes(router: Router): void {
  router.get(BASE, (ctx) => {
    const user = requirePermission(ctx, CATEGORIES_KEY, "view");
    if (user instanceof Response) return user;
    const q = ctx.query.get("q") ?? "";
    const pageNum = Number.parseInt(ctx.query.get("page") ?? "1", 10) || 1;
    const pageData = categoriesRepo.paginate({
      page: pageNum,
      search: q,
      searchColumn: "name_search",
      orderBy: "name COLLATE NOCASE",
    });
    if (ctx.isHtmx) return fragment(categoriesListFragment(user, pageData, q));
    return html(categoriesListPage(user, pageData, q));
  });

  router.get(`${BASE}/nueva`, (ctx) => {
    const user = requirePermission(ctx, CATEGORIES_KEY, "create");
    if (user instanceof Response) return user;
    return html(categoryFormPage(user));
  });

  router.post(BASE, async (ctx) => {
    const user = requirePermission(ctx, CATEGORIES_KEY, "create");
    if (user instanceof Response) return user;
    const form = await ctx.req.formData();
    const { data, errors } = validateCategory(form);
    if (!errors.slug && categoriesRepo.slugExists(data.slug)) errors.slug = "Ese slug ya existe.";
    if (errors.name || errors.slug) return html(categoryFormPage(user, { values: data, errors }), { status: 400 });
    categoriesRepo.insert(data.name, data.slug);
    return redirect(BASE);
  });

  router.get(`${BASE}/:id/editar`, (ctx) => {
    const user = requirePermission(ctx, CATEGORIES_KEY, "edit");
    if (user instanceof Response) return user;
    const cat = categoriesRepo.findById(ctx.params.id!);
    if (!cat) return notFound("Categoría no encontrada.");
    return html(categoryFormPage(user, { category: cat }));
  });

  router.post(`${BASE}/:id`, async (ctx) => {
    const user = requirePermission(ctx, CATEGORIES_KEY, "edit");
    if (user instanceof Response) return user;
    const cat = categoriesRepo.findById(ctx.params.id!);
    if (!cat) return notFound("Categoría no encontrada.");
    const form = await ctx.req.formData();
    const { data, errors } = validateCategory(form);
    if (!errors.slug && categoriesRepo.slugExists(data.slug, cat.id)) errors.slug = "Ese slug ya existe.";
    if (errors.name || errors.slug)
      return html(categoryFormPage(user, { category: cat, values: data, errors }), { status: 400 });
    categoriesRepo.update(cat.id, data.name, data.slug);
    return redirect(BASE);
  });

  router.post(`${BASE}/:id/eliminar`, (ctx) => {
    const user = requirePermission(ctx, CATEGORIES_KEY, "delete");
    if (user instanceof Response) return user;
    categoriesRepo.deleteById(ctx.params.id!);
    const pageData = categoriesRepo.paginate({ orderBy: "name COLLATE NOCASE" });
    return fragment(categoriesListFragment(user, pageData, ""));
  });
}
