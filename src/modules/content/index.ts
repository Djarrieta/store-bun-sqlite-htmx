/** Content module registration. */
import { AppModule, registerModule, type DashboardCard } from "../../core/modules.ts";
import type { Router } from "../../core/router.ts";
import "./content.db.ts";
import { CONTENT_KEY, ensureContentDefaults } from "./content.rules.ts";
import { registerContentRoutes } from "./content.views.ts";

ensureContentDefaults();

class ContentModule extends AppModule {
  readonly key = CONTENT_KEY;
  readonly title = "Contenido";

  registerRoutes(router: Router): void {
    registerContentRoutes(router);
  }

  dashboardCard(): DashboardCard {
    return {
      title: "Contenido",
      description: "Edita textos de la tienda (Nosotros, Pagos y envíos).",
      href: "/admin/contenido",
      moduleKey: CONTENT_KEY,
      action: "view",
    };
  }
}

registerModule(new ContentModule());
