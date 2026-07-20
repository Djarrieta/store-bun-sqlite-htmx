/** Feature-flags module registration. */
import { AppModule, registerModule, type DashboardCard } from "../../core/modules.ts";
import type { Router } from "../../core/router.ts";
import "./feature-flags.db.ts";
import { FLAGS_KEY } from "./feature-flags.rules.ts";
import { registerFeatureFlagsRoutes } from "./feature-flags.views.ts";

class FeatureFlagsModule extends AppModule {
  readonly key = FLAGS_KEY;
  readonly title = "Funcionalidades";

  registerRoutes(router: Router): void {
    registerFeatureFlagsRoutes(router);
  }

  dashboardCard(): DashboardCard {
    return {
      title: "Funcionalidades",
      description: "Activa o desactiva funcionalidades.",
      href: "/admin/flags",
      moduleKey: FLAGS_KEY,
      action: "view",
    };
  }
}

registerModule(new FeatureFlagsModule());
