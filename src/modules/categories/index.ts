/** Categories module registration. */
import { AppModule, registerModule, type DashboardCard } from "../../core/modules.ts";
import type { Router } from "../../core/router.ts";
import "./categories.db.ts";
import { CATEGORIES_KEY } from "./categories.rules.ts";
import { registerCategoriesRoutes } from "./categories.routes.ts";

class CategoriesModule extends AppModule {
  readonly key = CATEGORIES_KEY;
  readonly title = "Categorías";

  registerRoutes(router: Router): void {
    registerCategoriesRoutes(router);
  }

  dashboardCard(): DashboardCard {
    return {
      title: "Categorías",
      description: "Organiza el catálogo por categorías.",
      href: "/admin/categorias",
      moduleKey: CATEGORIES_KEY,
      action: "view",
    };
  }
}

registerModule(new CategoriesModule());
