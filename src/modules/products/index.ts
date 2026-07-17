/** Products module registration. */
import { AppModule, registerModule, type DashboardCard } from "../../core/modules.ts";
import type { Router } from "../../core/router.ts";
import "./products.db.ts";
import { PRODUCTS_KEY } from "./products.rules.ts";
import { registerProductsRoutes } from "./products.routes.ts";

class ProductsModule extends AppModule {
  readonly key = PRODUCTS_KEY;
  readonly title = "Productos";

  registerRoutes(router: Router): void {
    registerProductsRoutes(router);
  }

  dashboardCard(): DashboardCard {
    return {
      title: "Productos",
      description: "Gestiona el catálogo, imágenes y variantes.",
      href: "/admin/productos",
      moduleKey: PRODUCTS_KEY,
      action: "view",
    };
  }
}

registerModule(new ProductsModule());
